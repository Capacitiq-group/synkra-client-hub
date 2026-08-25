/**
 * SYNKRA Flow execution accounting + hard-limit rules (client-safe, pure).
 *
 * Usage model — do not change without changing the product rules:
 *   1 complete workflow run = 1 automation execution.
 *   Individual steps NEVER count. Retries of the same execution NEVER count
 *   twice (identified by execution_id). Failed runs DO count, because the run
 *   actually started. Draft workflows never consume executions; only an
 *   explicit Test Run touches the test path, which is metered by synkra-core.
 *
 * All numeric limits come from the central plan configuration in `@/lib/plans`.
 */
import {
  INTEGRATIONS_PAID_PLAN_NOTE,
  getDraftWorkflowLimit,
  getExecutionLimit,
  getMaxWorkflowSteps,
  getWorkflowLimit,
  getWorkspaceLimit,
  integrationsAllowed,
  normalizeTier,
  safeUsage,
  type PlanTier,
} from "@/lib/plans";

/** Workflow statuses that occupy an "active workflow" slot. */
export const ACTIVE_WORKFLOW_STATUSES = ["published"] as const;
/** Workflow statuses that occupy a "draft workflow" slot. */
export const DRAFT_WORKFLOW_STATUSES = ["draft", "paused", "error"] as const;

export const INTEGRATION_PLAN_MESSAGE = INTEGRATIONS_PAID_PLAN_NOTE;

export const EXECUTION_LIMIT_MESSAGE =
  "Your monthly automation execution limit has been reached.";

export type BlockedReason =
  | "execution_limit_reached"
  | "active_workflow_limit_reached"
  | "draft_workflow_limit_reached"
  | "step_limit_exceeded"
  | "workspace_limit_reached"
  | "integrations_requires_paid_plan";

export interface LimitDecision {
  allowed: boolean;
  reason?: BlockedReason;
  message?: string;
  used: number;
  limit: number;
  tier: PlanTier;
}

function ok(used: number, limit: number, tier: PlanTier): LimitDecision {
  return { allowed: true, used, limit, tier };
}

function blocked(
  reason: BlockedReason,
  message: string,
  used: number,
  limit: number,
  tier: PlanTier,
): LimitDecision {
  return { allowed: false, reason, message, used, limit, tier };
}

/** Counts billable steps in a workflow: every block except the trigger. */
export function countWorkflowSteps(blocks: Array<{ type?: string }> | undefined | null): number {
  if (!Array.isArray(blocks)) return 0;
  return blocks.filter((b) => b?.type !== "trigger").length;
}

/** Hard limit check performed BEFORE an execution is started. */
export function checkExecutionAllowed(tierInput: unknown, executionsUsed: unknown): LimitDecision {
  const tier = normalizeTier(tierInput);
  const used = safeUsage(executionsUsed);
  const limit = getExecutionLimit(tier);
  if (used >= limit) {
    return blocked("execution_limit_reached", EXECUTION_LIMIT_MESSAGE, used, limit, tier);
  }
  return ok(used, limit, tier);
}

export function checkActivationAllowed(tierInput: unknown, activeCount: number): LimitDecision {
  const tier = normalizeTier(tierInput);
  const limit = getWorkflowLimit(tier);
  if (activeCount >= limit) {
    return blocked(
      "active_workflow_limit_reached",
      `You have reached your plan limit of ${limit} active workflows. Pause an active workflow or upgrade your plan to activate another one.`,
      activeCount,
      limit,
      tier,
    );
  }
  return ok(activeCount, limit, tier);
}

export function checkDraftAllowed(tierInput: unknown, draftCount: number): LimitDecision {
  const tier = normalizeTier(tierInput);
  const limit = getDraftWorkflowLimit(tier);
  if (draftCount >= limit) {
    return blocked(
      "draft_workflow_limit_reached",
      `You have reached your plan limit of ${limit} draft workflows. Delete a draft or upgrade your plan to create another one.`,
      draftCount,
      limit,
      tier,
    );
  }
  return ok(draftCount, limit, tier);
}

export function checkStepsAllowed(tierInput: unknown, stepCount: number): LimitDecision {
  const tier = normalizeTier(tierInput);
  const limit = getMaxWorkflowSteps(tier);
  if (stepCount > limit) {
    return blocked(
      "step_limit_exceeded",
      `Your plan allows a maximum of ${limit} steps per workflow. Remove ${stepCount - limit} step${stepCount - limit === 1 ? "" : "s"} or upgrade your plan.`,
      stepCount,
      limit,
      tier,
    );
  }
  return ok(stepCount, limit, tier);
}

export function checkWorkspaceAllowed(tierInput: unknown, workspaceCount: number): LimitDecision {
  const tier = normalizeTier(tierInput);
  const limit = getWorkspaceLimit(tier);
  if (workspaceCount >= limit) {
    return blocked(
      "workspace_limit_reached",
      `Your current plan supports ${limit} workspace. Upgrade your plan for additional workspace capacity.`,
      workspaceCount,
      limit,
      tier,
    );
  }
  return ok(workspaceCount, limit, tier);
}

/**
 * Gate for connecting an external platform. Free tier is blocked outright;
 * paid tiers are always allowed — there is deliberately NO count limit, so the
 * decision carries limit 0 as "not applicable".
 */
export function checkIntegrationConnectAllowed(tierInput: unknown): LimitDecision {
  const tier = normalizeTier(tierInput);
  if (!integrationsAllowed(tier)) {
    return blocked("integrations_requires_paid_plan", INTEGRATION_PLAN_MESSAGE, 0, 0, tier);
  }
  return ok(0, 0, tier);
}

/** First instant (UTC) of the calendar month a date falls in. */
export function periodStartFor(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

/** True when the stored billing period start is older than the current month. */
export function periodHasRolledOver(storedStart: unknown, now: Date = new Date()): boolean {
  if (typeof storedStart !== "string" || !storedStart) return true;
  const stored = new Date(storedStart.replace(" ", "T"));
  if (Number.isNaN(stored.getTime())) return true;
  return (
    stored.getUTCFullYear() !== now.getUTCFullYear() || stored.getUTCMonth() !== now.getUTCMonth()
  );
}

/** Trigger types the execution engine may start a billable run from. */
export const EXECUTION_TRIGGERS = [
  "webhook",
  "schedule",
  "app_event",
  "form",
  "incoming_event",
  "manual",
] as const;

export type ExecutionTrigger = (typeof EXECUTION_TRIGGERS)[number];

export function isExecutionTrigger(value: unknown): value is ExecutionTrigger {
  return typeof value === "string" && (EXECUTION_TRIGGERS as readonly string[]).includes(value);
}
