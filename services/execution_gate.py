"""
The execution gate — every real workflow run in this system MUST pass
through start_execution() before running any block, and report back
through complete_execution() when it's done.

This deliberately does NOT touch PocketBase directly and does NOT
duplicate any limit-checking logic. All of that already exists,
correctly, in client-hub's executions.server.ts — the monthly counter,
the per-plan limits (themselves read from plans.ts, the single source
of truth for pricing), the retry-safe execution_id handling, and the
workflow_runs record itself. This module just calls it over HTTP.

Previously, scheduler.py, webhooks.py, and inbound_email.py each wrote
directly to workflow_runs/users via PocketBase, silently bypassing this
gate entirely — meaning execution limits were never actually enforced
by anything that runs a workflow. That's what this module fixes.
"""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

CLIENT_APP_URL = os.environ.get("CLIENT_APP_URL", "https://client.synkra.co.za")
API_SECRET = os.environ.get("API_SECRET", "")


class ExecutionBlocked(Exception):
    """Raised when start_execution() reports the run isn't allowed to happen."""

    def __init__(self, reason: str, message: str, usage: dict):
        self.reason = reason
        self.message = message
        self.usage = usage
        super().__init__(message)


async def start_execution(
    user_id: str,
    workflow_id: str,
    execution_id: str,
    trigger_type: str,
    input_data: dict | None = None,
    is_test_run: bool = False,
) -> dict:
    """
    Must be called before running any blocks. Returns the start result
    (including the real workflow_runs id as "runId") when allowed.
    Raises ExecutionBlocked when the account is over its monthly limit —
    callers should catch this and stop, not run any blocks.

    trigger_type must be one of: webhook, schedule, app_event, form,
    incoming_event (the execution API's fixed set — NOT the same set as
    a workflow's own trigger_type field, which is free text). Email
    triggers should use "incoming_event".
    """
    if not API_SECRET:
        logger.error("API_SECRET is not set — cannot call the execution gate.")
        raise ExecutionBlocked(
            "configuration_error",
            "Server misconfiguration: execution gate secret is not set.",
            {"used": 0, "limit": 0, "tier": "free"},
        )

    payload = {
        "user_id": user_id,
        "workflow_id": workflow_id,
        "execution_id": execution_id,
        "trigger_type": trigger_type,
    }
    if input_data is not None:
        payload["input_data"] = input_data
    if is_test_run:
        payload["is_test_run"] = True

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{CLIENT_APP_URL}/api/public/executions/start",
                json=payload,
                headers={"x-synkra-secret": API_SECRET},
            )
    except Exception as exc:
        logger.error(f"Execution gate unreachable: {exc}")
        raise ExecutionBlocked(
            "gate_unreachable",
            "Could not reach the execution limit service.",
            {"used": 0, "limit": 0, "tier": "free"},
        )

    data = response.json()

    if response.status_code == 402 or not data.get("allowed"):
        raise ExecutionBlocked(
            data.get("reason", "execution_limit_reached"),
            data.get("message", "Execution not allowed."),
            data.get("usage", {}),
        )

    if response.status_code >= 500:
        logger.error(f"Execution gate returned {response.status_code}: {data}")
        raise ExecutionBlocked(
            "gate_error",
            "Execution limit service returned an error.",
            data.get("usage", {}),
        )

    return data


async def complete_execution(
    execution_id: str,
    status: str,
    step_logs=None,
    output_data=None,
    error_message: str | None = None,
    duration_ms: int | None = None,
) -> None:
    """
    Reports the outcome of a run started with start_execution(). Never
    raises — a failure to report completion shouldn't crash the caller,
    since the run already happened; it's just logged.
    """
    if not API_SECRET:
        return

    payload = {"execution_id": execution_id, "status": status}
    if step_logs is not None:
        payload["step_logs"] = step_logs
    if output_data is not None:
        payload["output_data"] = output_data
    if error_message:
        payload["error_message"] = error_message[:4000]
    if duration_ms is not None:
        payload["duration_ms"] = duration_ms

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{CLIENT_APP_URL}/api/public/executions/complete",
                json=payload,
                headers={"x-synkra-secret": API_SECRET},
            )
        if response.status_code >= 400:
            logger.error(f"complete_execution failed ({response.status_code}): {response.text[:300]}")
    except Exception as exc:
        logger.error(f"complete_execution unreachable: {exc}")
