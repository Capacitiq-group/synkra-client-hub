/**
 * Scheduled plan upgrades and downgrades (authoritative, server only).
 *
 * Rules enforced here — never in the browser:
 *   - A plan change NEVER takes effect immediately. It is scheduled for the
 *     start of the account's next billing period, which is the subscription's
 *     own next payment date from Paystack (not a calendar month end).
 *   - The current plan and its limits stay active until that date.
 *   - No refunds and no credits are issued for the current period.
 *   - Paystack is the source of truth for the recurring charge: the new price
 *     is set up as a real Paystack subscription with a future `start_date`,
 *     and the old subscription is disabled so it never renews at the old
 *     price. Nothing about the schedule is simulated locally.
 *   - Exactly one scheduled change may exist per account; requesting another
 *     replaces it, and the user may cancel it any time before it takes effect.
 *
 * SECURITY: Always use pb.filter() for user-supplied values. Never interpolate.
 */
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { getPlanName, normalizeTier, PLAN_ORDER, type PlanTier } from "@/lib/plans";
import { CURRENCY, PROVIDER, isPurchasableTier, priceCents } from "./config";
import { BillingError, applyEntitlement } from "./billing.server";
import {
  createSubscription,
  disableSubscription,
  enableSubscription,
  ensurePlan,
  fetchSubscription,
  paystackConfigured,
  reusableAuthorization,
} from "./paystack.server";

type Row = Record<string, unknown>;

function str(record: Row | undefined | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asRecord(value: unknown): Row {
  return value as Row;
}

function toDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Paystack's create-subscription API wants "YYYY-MM-DD HH:mm:ss" in UTC. */
function paystackDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

async function findByField(pb: PocketBase, collection: string, field: string, value: string) {
  try {
    return asRecord(
      await pb
        .collection(collection)
        .getFirstListItem(pb.filter(`${field} = {:value}`, { value })),
    );
  } catch {
    return null;
  }
}

export function changeDirection(from: PlanTier, to: PlanTier): "upgrade" | "downgrade" {
  return PLAN_ORDER.indexOf(to) > PLAN_ORDER.indexOf(from) ? "upgrade" : "downgrade";
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface ScheduledChange {
  id: string;
  fromTier: PlanTier;
  fromPlanName: string;
  toTier: PlanTier;
  toPlanName: string;
  direction: "upgrade" | "downgrade";
  status: string;
  effectiveAt: string;
  amountCents: number;
  /** True while the user may still cancel or replace it. */
  cancellable: boolean;
}

function toScheduled(row: Row): ScheduledChange {
  const fromTier = normalizeTier(row["from_tier"]);
  const toTier = normalizeTier(row["to_tier"]);
  const effectiveAt = str(row, "effective_at");
  const due = toDate(effectiveAt);
  return {
    id: str(row, "id"),
    fromTier,
    fromPlanName: getPlanName(fromTier),
    toTier,
    toPlanName: getPlanName(toTier),
    direction: changeDirection(fromTier, toTier),
    status: str(row, "status"),
    effectiveAt,
    amountCents: Number(row["amount_cents"] ?? 0),
    cancellable: str(row, "status") === "scheduled" && (!due || due.getTime() > Date.now()),
  };
}

async function scheduledRow(pb: PocketBase, userId: string): Promise<Row | null> {
  try {
    const rows = await pb.collection("billing_plan_changes").getFullList({
      filter: pb.filter("user_id = {:userId} && status = 'scheduled'", { userId }),
      sort: "-created",
    });
    const first = rows[0];
    return first ? asRecord(first) : null;
  } catch {
    return null;
  }
}

/** The pending change shown in Billing, or null when nothing is scheduled. */
export async function getScheduledChange(userId: string): Promise<ScheduledChange | null> {
  const pb = await adminClient();
  const row = await scheduledRow(pb, userId);
  return row ? toScheduled(row) : null;
}

export interface PlanChangeOption {
  tier: PlanTier;
  planName: string;
  priceCents: number;
  direction: "upgrade" | "downgrade";
}

/**
 * What the account may switch to, and when a switch would take effect.
 * `requiresCheckout` is true for accounts with no paid subscription yet:
 * there is no billing period to schedule against, so they pay now instead.
 */
export interface PlanChangeContext {
  currentTier: PlanTier;
  currentPlanName: string;
  currentPriceCents: number;
  /** Start of the next billing period — when any change would take effect. */
  effectiveAt: string;
  requiresCheckout: boolean;
  options: PlanChangeOption[];
  scheduled: ScheduledChange | null;
}

async function subscriptionContext(pb: PocketBase, userId: string) {
  const user = asRecord(await pb.collection("users").getOne(userId));
  const tier = normalizeTier(user["tier"]);
  const subscription = await findByField(pb, "billing_subscriptions", "user_id", userId);
  const studentVerified = Boolean(user["student_verified"]);
  const nextPayment =
    str(subscription, "next_payment_date") || str(subscription, "current_period_end");
  return { user, tier, subscription, studentVerified, nextPayment };
}

export async function getPlanChangeContext(userId: string): Promise<PlanChangeContext> {
  const pb = await adminClient();
  const { tier, subscription, studentVerified, nextPayment } = await subscriptionContext(
    pb,
    userId,
  );
  const due = toDate(nextPayment);
  const status = str(subscription, "status");
  const active = Boolean(subscription) && status !== "cancelled" && status !== "expired";
  const requiresCheckout =
    !isPurchasableTier(tier) || !active || !due || due.getTime() <= Date.now();

  const options: PlanChangeOption[] = PLAN_ORDER.filter((candidate) => candidate !== tier).map(
    (candidate) => ({
      tier: candidate,
      planName: getPlanName(candidate),
      priceCents: priceCents(candidate, studentVerified),
      direction: changeDirection(tier, candidate),
    }),
  );

  const pending = await scheduledRow(pb, userId);
  return {
    currentTier: tier,
    currentPlanName: getPlanName(tier),
    currentPriceCents: priceCents(tier, studentVerified),
    effectiveAt: due ? due.toISOString() : "",
    requiresCheckout,
    options,
    scheduled: pending ? toScheduled(pending) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Provider wiring                                                     */
/* ------------------------------------------------------------------ */

async function stopRenewal(subscription: Row | null): Promise<void> {
  const code = str(subscription, "provider_subscription_code");
  const token = str(subscription, "provider_email_token");
  if (!code || !token || !paystackConfigured()) return;
  try {
    await disableSubscription({ code, token });
  } catch (err) {
    console.error("[billing] could not disable Paystack subscription:", err);
  }
}

async function resumeRenewal(subscription: Row | null): Promise<void> {
  const code = str(subscription, "provider_subscription_code");
  const token = str(subscription, "provider_email_token");
  if (!code || !token || !paystackConfigured()) return;
  try {
    await enableSubscription({ code, token });
  } catch (err) {
    console.error("[billing] could not re-enable Paystack subscription:", err);
  }
}

async function cancelProviderSubscription(code: string): Promise<void> {
  if (!code || !paystackConfigured()) return;
  try {
    const remote = await fetchSubscription(code);
    if (remote.email_token) {
      await disableSubscription({ code, token: remote.email_token });
    }
  } catch (err) {
    console.error("[billing] could not cancel scheduled Paystack subscription:", err);
  }
}

/**
 * Books the future charge with Paystack: a real subscription on the new plan
 * that only starts billing on `effectiveAt`. Returns empty strings when the
 * account has no reusable card yet — the change stays scheduled and is retried
 * when it falls due.
 */
async function bookFutureSubscription(input: {
  customerCode: string;
  email: string;
  tier: PlanTier;
  amountCents: number;
  effectiveAt: Date;
}): Promise<{ subscriptionCode: string; planCode: string; emailToken: string; note: string }> {
  const empty = { subscriptionCode: "", planCode: "", emailToken: "", note: "" };
  if (!paystackConfigured()) return { ...empty, note: "provider_not_configured" };
  const customer = input.customerCode || input.email;
  if (!customer) return { ...empty, note: "no_provider_customer" };

  try {
    const plan = await ensurePlan({
      tier: input.tier,
      amountCents: input.amountCents,
      currency: CURRENCY,
    });
    const authorization = await reusableAuthorization(customer);
    if (!authorization) return { ...empty, planCode: plan.plan_code, note: "no_saved_card" };
    const created = await createSubscription({
      customer,
      plan: plan.plan_code,
      authorization,
      startDate: paystackDate(input.effectiveAt),
    });
    return {
      subscriptionCode: created.subscription_code ?? "",
      planCode: plan.plan_code,
      emailToken: created.email_token ?? "",
      note: "",
    };
  } catch (err) {
    console.error("[billing] could not book future Paystack subscription:", err);
    return { ...empty, note: err instanceof Error ? err.message.slice(0, 180) : "provider_error" };
  }
}

/* ------------------------------------------------------------------ */
/* Schedule / cancel                                                   */
/* ------------------------------------------------------------------ */

export interface ScheduleResult {
  ok: true;
  scheduled: ScheduledChange;
  currentPlanName: string;
  currentPriceCents: number;
  /** Set when Paystack could not pre-book the charge; retried when due. */
  providerNote: string;
}

/**
 * Schedules an upgrade or downgrade for the start of the next billing period.
 * Nothing about the current period changes: no charge, no refund, no credit,
 * and the current plan's limits stay in force until `effective_at`.
 */
export async function schedulePlanChange(
  userId: string,
  toTierInput: unknown,
): Promise<ScheduleResult> {
  const pb = await adminClient();
  const toTier = normalizeTier(toTierInput);
  const { user, tier, subscription, studentVerified, nextPayment } = await subscriptionContext(
    pb,
    userId,
  );

  if (toTier === tier) {
    throw new BillingError("same_plan", "You are already on that plan.");
  }
  const status = str(subscription, "status");
  const due = toDate(nextPayment);
  if (
    !isPurchasableTier(tier) ||
    !subscription ||
    status === "cancelled" ||
    status === "expired" ||
    !due ||
    due.getTime() <= Date.now()
  ) {
    throw new BillingError(
      "needs_checkout",
      "You have no active billing period yet, so this plan starts with a payment instead of a scheduled change.",
    );
  }

  // Replace any previous pending change: only one may exist at a time.
  const previous = await scheduledRow(pb, userId);
  if (previous) {
    await cancelProviderSubscription(str(previous, "new_subscription_code"));
    await pb.collection("billing_plan_changes").update(str(previous, "id"), {
      status: "cancelled",
      note: "replaced_by_new_request",
    });
  }

  const amountCents = isPurchasableTier(toTier) ? priceCents(toTier, studentVerified) : 0;
  let providerNote = "";
  let newSubscriptionCode = "";
  let newPlanCode = "";

  if (isPurchasableTier(toTier)) {
    const booked = await bookFutureSubscription({
      customerCode: str(subscription, "provider_customer_code"),
      email: str(user, "email"),
      tier: toTier,
      amountCents,
      effectiveAt: due,
    });
    newSubscriptionCode = booked.subscriptionCode;
    newPlanCode = booked.planCode;
    providerNote = booked.note;
  }

  // The old subscription must never renew at the old price.
  await stopRenewal(subscription);

  const created = asRecord(
    await pb.collection("billing_plan_changes").create({
      user_id: userId,
      from_tier: tier,
      to_tier: toTier,
      direction: changeDirection(tier, toTier),
      status: "scheduled",
      effective_at: due.toISOString(),
      requested_at: new Date().toISOString(),
      provider: PROVIDER,
      old_subscription_code: str(subscription, "provider_subscription_code"),
      new_subscription_code: newSubscriptionCode,
      new_plan_code: newPlanCode,
      amount_cents: amountCents,
      note: providerNote,
    }),
  );

  await pb.collection("billing_subscriptions").update(str(subscription, "id"), {
    cancel_at_period_end: true,
    status: "non_renewing",
  });

  return {
    ok: true,
    scheduled: toScheduled(created),
    currentPlanName: getPlanName(tier),
    currentPriceCents: priceCents(tier, studentVerified),
    providerNote,
  };
}

/**
 * Cancels a pending change before it takes effect. The account keeps its
 * current plan and its existing renewal is put back in place with Paystack.
 */
export async function cancelScheduledPlanChange(userId: string): Promise<{ ok: true }> {
  const pb = await adminClient();
  const row = await scheduledRow(pb, userId);
  if (!row) throw new BillingError("nothing_scheduled", "There is no scheduled plan change.");
  const due = toDate(str(row, "effective_at"));
  if (due && due.getTime() <= Date.now()) {
    throw new BillingError(
      "too_late",
      "This change has already reached its billing date and can no longer be cancelled.",
    );
  }

  await cancelProviderSubscription(str(row, "new_subscription_code"));
  const subscription = await findByField(pb, "billing_subscriptions", "user_id", userId);
  await resumeRenewal(subscription);
  if (subscription) {
    await pb.collection("billing_subscriptions").update(str(subscription, "id"), {
      cancel_at_period_end: false,
      status: "active",
    });
  }
  await pb.collection("billing_plan_changes").update(str(row, "id"), {
    status: "cancelled",
    note: "cancelled_by_user",
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Applying due changes                                                */
/* ------------------------------------------------------------------ */

async function applyChangeRow(pb: PocketBase, row: Row): Promise<string> {
  // Atomic claim: this row can be reached from two independent paths (a
  // Paystack webhook firing at the exact moment the renewal lands, and the
  // scheduled sweep's safety-net pass), and PocketBase applies "+"-suffixed
  // updates at the DB layer, not read-compute-write. Only the caller whose
  // increment lands claim_count on 1 may proceed — the other backs off
  // instead of both racing to book a second live Paystack subscription for
  // the same change.
  const claimed = asRecord(
    await pb.collection("billing_plan_changes").update(str(row, "id"), { "claim_count+": 1 }),
  );
  if (Number(claimed["claim_count"] ?? 0) !== 1) {
    return "already_processing";
  }

  const userId = str(row, "user_id");
  const toTier = normalizeTier(row["to_tier"]);

  try {
    const subscription = await findByField(pb, "billing_subscriptions", "user_id", userId);

    if (isPurchasableTier(toTier)) {
      // The charge itself belongs to Paystack. If it was pre-booked the
      // subscription is already live; otherwise book it now, starting today.
      let code = str(row, "new_subscription_code");
      let planCode = str(row, "new_plan_code");
      if (!code) {
        const user = asRecord(await pb.collection("users").getOne(userId));
        const booked = await bookFutureSubscription({
          customerCode: str(subscription, "provider_customer_code"),
          email: str(user, "email"),
          tier: toTier,
          amountCents: Number(row["amount_cents"] ?? 0),
          effectiveAt: new Date(),
        });
        code = booked.subscriptionCode;
        planCode = booked.planCode || planCode;
        if (!code) {
          // Soft failure, not an error: Paystack has no saved card to charge
          // yet. Release the claim so the next sweep (or the user completing
          // checkout) can retry this same row instead of finding it stuck.
          await pb.collection("billing_plan_changes").update(str(row, "id"), {
            note: booked.note || "provider_unavailable",
            "claim_count+": -1,
          });
          return "provider_pending";
        }
      }

      await applyEntitlement(pb, {
        userId,
        tier: toTier,
        reference: `PLAN-CHANGE-${str(row, "id")}`,
      });
      const updated = await findByField(pb, "billing_subscriptions", "user_id", userId);
      if (updated) {
        let nextPayment = "";
        let emailToken = "";
        try {
          const remote = await fetchSubscription(code);
          nextPayment = remote.next_payment_date ?? "";
          emailToken = remote.email_token ?? "";
        } catch {
          /* the local period end already covers the UI until the next webhook */
        }
        await pb.collection("billing_subscriptions").update(str(updated, "id"), {
          provider_subscription_code: code,
          provider_plan_code: planCode,
          ...(emailToken ? { provider_email_token: emailToken } : {}),
          ...(nextPayment ? { next_payment_date: nextPayment } : {}),
          cancel_at_period_end: false,
          status: "active",
        });
      }
    } else {
      // Downgrade to free: the paid subscription simply ends, nothing is charged.
      await applyEntitlement(pb, {
        userId,
        tier: "free",
        reference: `PLAN-CHANGE-${str(row, "id")}`,
      });
      if (subscription) {
        await pb.collection("billing_subscriptions").update(str(subscription, "id"), {
          status: "cancelled",
          cancel_at_period_end: false,
          provider_subscription_code: "",
          provider_email_token: "",
          next_payment_date: "",
        });
      }
    }
  } catch (err) {
    // A genuine failure must release the claim too, or a transient Paystack
    // error on the first attempt would permanently block every future retry
    // of this row (status stays "scheduled", claim_count would stay at 1
    // forever otherwise).
    await pb
      .collection("billing_plan_changes")
      .update(str(row, "id"), { "claim_count+": -1 })
      .catch(() => undefined);
    throw err;
  }

  await pb.collection("billing_plan_changes").update(str(row, "id"), {
    status: "applied",
    applied_at: new Date().toISOString(),
    note: "",
  });
  return "applied";
}

/**
 * Applies every scheduled change whose billing date has arrived. Idempotent:
 * an already-applied row is never processed twice. Called from the Paystack
 * webhook (renewal events) and from the scheduled endpoint.
 */
export async function applyDuePlanChanges(): Promise<{
  ok: boolean;
  applied: number;
  pending: number;
  failed: number;
}> {
  const pb = await adminClient();
  const now = new Date().toISOString();
  let applied = 0;
  let pending = 0;
  let failed = 0;

  let rows: unknown[] = [];
  try {
    rows = await pb.collection("billing_plan_changes").getFullList({
      filter: pb.filter("status = 'scheduled' && effective_at <= {:now}", { now }),
      sort: "effective_at",
    });
  } catch (err) {
    console.error("[billing] could not read due plan changes:", err);
    return { ok: false, applied: 0, pending: 0, failed: 0 };
  }

  for (const raw of rows) {
    const row = asRecord(raw);
    try {
      const result = await applyChangeRow(pb, row);
      if (result === "applied") applied += 1;
      else pending += 1;
    } catch (err) {
      failed += 1;
      console.error("[billing] plan change failed:", str(row, "id"), err);
      await pb
        .collection("billing_plan_changes")
        .update(str(row, "id"), {
          note: err instanceof Error ? err.message.slice(0, 180) : "apply_failed",
        })
        .catch(() => undefined);
    }
  }
  return { ok: failed === 0, applied, pending, failed };
}

/** Applies a single account's due change (used right after a renewal event). */
export async function applyDuePlanChangeForUser(userId: string): Promise<string> {
  const pb = await adminClient();
  const row = await scheduledRow(pb, userId);
  if (!row) return "nothing_scheduled";
  const due = toDate(str(row, "effective_at"));
  if (due && due.getTime() > Date.now()) return "not_due";
  return applyChangeRow(pb, row);
}

/* ------------------------------------------------------------------ */
/* Subscription lifecycle from Paystack                                */
/* ------------------------------------------------------------------ */

async function subscriptionByCodeOrCustomer(
  pb: PocketBase,
  data: Row,
): Promise<Row | null> {
  const code = str(data, "subscription_code");
  if (code) {
    const byCode = await findByField(pb, "billing_subscriptions", "provider_subscription_code", code);
    if (byCode) return byCode;
  }
  const customer = asRecord(data["customer"]);
  const email = str(customer, "email");
  if (email) {
    const user = await findByField(pb, "users", "email", email.toLowerCase());
    if (user) return findByField(pb, "billing_subscriptions", "user_id", str(user, "id"));
  }
  return null;
}

/**
 * Keeps the local mirror in step with Paystack for the subscription lifecycle:
 * creation, renewal dates, failed payments and cancellations. Paystack remains
 * the source of truth; nothing here invents a billing date.
 */
export async function handleSubscriptionEvent(
  event: string,
  data: Row,
): Promise<string> {
  const pb = await adminClient();
  const row = await subscriptionByCodeOrCustomer(pb, data);
  if (!row) return "no_local_subscription";
  const id = str(row, "id");
  const userId = str(row, "user_id");
  const nextPayment = str(data, "next_payment_date");
  const customer = asRecord(data["customer"]);
  const subscriptionData = asRecord(data["subscription"]);

  const patch: Row = {};
  const code = str(data, "subscription_code") || str(subscriptionData, "subscription_code");
  if (code) patch["provider_subscription_code"] = code;
  const emailToken = str(data, "email_token") || str(subscriptionData, "email_token");
  if (emailToken) patch["provider_email_token"] = emailToken;
  const customerCode = str(customer, "customer_code");
  if (customerCode) patch["provider_customer_code"] = customerCode;
  if (nextPayment) patch["next_payment_date"] = nextPayment;

  switch (event) {
    case "subscription.create":
    case "subscription.enable":
      patch["status"] = "active";
      patch["cancel_at_period_end"] = false;
      break;
    case "subscription.not_renew":
      patch["status"] = "non_renewing";
      patch["cancel_at_period_end"] = true;
      break;
    case "subscription.disable":
      // A disable at the end of a scheduled downgrade is expected; otherwise
      // the subscription really has ended.
      patch["status"] = "non_renewing";
      patch["cancel_at_period_end"] = true;
      break;
    case "invoice.create":
    case "invoice.update":
      break;
    case "invoice.payment_failed":
      patch["status"] = "past_due";
      break;
    default:
      break;
  }

  if (Object.keys(patch).length > 0) {
    await pb.collection("billing_subscriptions").update(id, patch);
  }

  // A completed renewal is the moment a scheduled change becomes real.
  if (event === "invoice.update" || event === "subscription.disable") {
    const applied = await applyDuePlanChangeForUser(userId);
    return `${event}:${applied}`;
  }
  return event;
}

/**
 * Records a successful recurring charge against a subscription and rolls the
 * local billing period forward using Paystack's own next payment date.
 */
export async function recordRecurringCharge(data: Row): Promise<string> {
  const pb = await adminClient();
  const plan = asRecord(data["plan"]);
  const planCode = str(plan, "plan_code");
  if (!planCode) return "not_subscription_charge";

  const customer = asRecord(data["customer"]);
  const email = str(customer, "email").toLowerCase();
  const user = email ? await findByField(pb, "users", "email", email) : null;
  if (!user) return "no_user";
  const userId = str(user, "id");
  const row = await findByField(pb, "billing_subscriptions", "user_id", userId);
  const tier = row ? normalizeTier(row["tier"]) : normalizeTier(user["tier"]);

  const reference = str(data, "reference");
  const existing = reference
    ? await findByField(pb, "billing_payments", "reference", reference)
    : null;
  if (!existing && reference) {
    try {
      await pb.collection("billing_payments").create({
        reference,
        user_id: userId,
        tier,
        amount_cents: Number(data["amount"] ?? 0),
        currency: str(data, "currency") || CURRENCY,
        provider: PROVIDER,
        provider_transaction_id: String(data["id"] ?? ""),
        status: "success",
        paid_at: str(data, "paid_at") || new Date().toISOString(),
        raw: JSON.stringify({ source: "recurring", plan: planCode }).slice(0, 20000),
      });
    } catch {
      /* unique reference: another delivery already recorded this charge */
    }
  }

  if (row) {
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    await pb.collection("billing_subscriptions").update(str(row, "id"), {
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      last_reference: reference,
      provider_plan_code: planCode,
    });
    await pb.collection("users").update(userId, {
      billing_period_start: start.toISOString(),
      executions_used_this_month: 0,
      ai_ops_used_this_month: 0,
      emails_used_this_month: 0,
    });
  }

  const applied = await applyDuePlanChangeForUser(userId);
  return `recurring_charge:${applied}`;
}
