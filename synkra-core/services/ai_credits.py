"""
AI operation metering: checks and consumes one AI operation against the
account's monthly included allowance, falling back to purchased
addon_credits (kind="ai_ops") once that's exhausted, blocking only when
both are gone.

Deliberately separate from services/credits.py, which belongs to a
different product line entirely (a "clients" collection with
application_credit_balance/purchased_credit_balance fields — that's not
this system; confirmed that collection doesn't even exist on this
PocketBase instance).
"""

import logging
from datetime import datetime, timezone

from services.pocketbase import get_record, update_record, find_one, create_record
from services.plan_limits import get_plan_limits

logger = logging.getLogger(__name__)

# Every monthly counter that shares the single billing_period_start
# anchor. Whichever code path detects rollover first must reset ALL of
# these together, or counters checked by a different path later in the
# same month would see billing_period_start already advanced and skip
# their own reset.
_MONTHLY_COUNTER_FIELDS = [
    "executions_used_this_month",
    "ai_ops_used_this_month",
    "emails_used_this_month",
    "sms_used_this_month",
    "whatsapp_used_this_month",
    "voice_minutes_used_this_month",
]


def _period_start_for(now: datetime) -> str:
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()


def _period_has_rolled_over(stored_start, now: datetime) -> bool:
    if not isinstance(stored_start, str) or not stored_start:
        return True
    try:
        stored = datetime.fromisoformat(stored_start.replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return True
    return stored.year != now.year or stored.month != now.month


async def _roll_over_if_needed(user: dict) -> dict:
    """
    Returns the user dict as it should be treated for this check — with
    every monthly counter reset to 0 if the period rolled over, and
    billing_period_start advanced. Persists the reset if one happened.
    """
    now = datetime.now(timezone.utc)
    if not _period_has_rolled_over(user.get("billing_period_start"), now):
        return user

    reset_fields = {field: 0 for field in _MONTHLY_COUNTER_FIELDS}
    reset_fields["billing_period_start"] = _period_start_for(now)
    await update_record("users", user["id"], reset_fields)
    logger.info(f"Monthly usage counters rolled over for user {user['id']}.")
    return {**user, **reset_fields}


async def _get_addon_credit_balance(user_id: str, kind: str) -> tuple[dict | None, int]:
    record = await find_one("addon_credits", f'user_id = "{user_id}" && kind = "{kind}"')
    if not record:
        return None, 0
    remaining = int(record.get("units_purchased") or 0) - int(record.get("units_used") or 0)
    return record, max(remaining, 0)


async def consume_ai_op(user_id: str, amount: int = 1) -> dict:
    """
    Call this before an AI block actually runs. Returns:
      {"allowed": True, "source": "included" | "addon", "remaining_included": int, "remaining_addon": int}
      {"allowed": False, "reason": "ai_ops_limit_reached", "message": str}

    Order: included monthly allowance first, then purchased addon_credits,
    then blocked. Never lets the AI provider get called before this
    returns allowed=True — same principle as the execution gate.
    """
    user = await get_record("users", user_id)
    if not user:
        return {"allowed": False, "reason": "user_not_found", "message": "Account not found."}

    user = await _roll_over_if_needed(user)

    tier = user.get("tier", "free")
    plan_limits = await get_plan_limits()
    if not plan_limits:
        # Fail closed: if we genuinely cannot learn the plan limits, don't
        # let AI operations run unmetered — that's how usage silently
        # becomes unlimited by accident.
        logger.error("consume_ai_op: no plan limits available, failing closed.")
        return {
            "allowed": False,
            "reason": "limits_unavailable",
            "message": "Could not verify AI operation allowance right now.",
        }

    included_limit = plan_limits.get(tier, {}).get("aiOps", 0)
    included_used = int(user.get("ai_ops_used_this_month") or 0)

    if included_used + amount <= included_limit:
        await update_record("users", user_id, {"ai_ops_used_this_month": included_used + amount})
        return {
            "allowed": True,
            "source": "included",
            "remaining_included": included_limit - (included_used + amount),
            "remaining_addon": None,
        }

    addon_record, addon_remaining = await _get_addon_credit_balance(user_id, "ai_ops")
    if addon_remaining >= amount:
        await update_record(
            "addon_credits",
            addon_record["id"],
            {"units_used": int(addon_record.get("units_used") or 0) + amount},
        )
        return {
            "allowed": True,
            "source": "addon",
            "remaining_included": 0,
            "remaining_addon": addon_remaining - amount,
        }

    return {
        "allowed": False,
        "reason": "ai_ops_limit_reached",
        "message": "This account has used its monthly AI operations and has no additional AI credits. "
                    "Buy more AI operations or upgrade to continue.",
}
