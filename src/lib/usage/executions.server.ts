/**
 * Execution accounting + hard-limit enforcement (authoritative, server only).
 *
 * Rules implemented here:
 *   - One workflow run = one execution. Steps never count individually.
 *   - A retry reuses the same execution_id and never counts twice.
 *   - A failed run still counts (it started); failed steps never count.
 *   - The monthly limit is checked BEFORE any part of the run starts.
 *   - A blocked attempt is recorded in workflow_runs with status "blocked".
 */
import type PocketBase from "pocketbase";
import { adminClient } from "./pocketbase.server";
import {
  ACTIVE_WORKFLOW_STATUSES,
  DRAFT_WORKFLOW_STATUSES,
  EXECUTION_LIMIT_MESSAGE,
  checkActivationAllowed,
  checkDraftAllowed,
  checkExecutionAllowed,
  checkStepsAllowed,
  checkWorkspaceAllowed,
  countWorkflowSteps,
  periodHasRolledOver,
  periodStartFor,
  type LimitDecision,
} from "./limits";
import { normalizeTier, safeUsage, type PlanTier } from "@/lib/plans";

export interface UsageSnapshot {
  userId: string;
  tier: PlanTier;
  executionsUsed: number;
  billingPeriodStart: string;
}

/**
 * Reads the user's tier + monthly execution usage, rolling the counter over to
 * zero when the stored billing period belongs to a previous month.
 */
export async function loadUsage(pb: PocketBase, userId: string): Promise<UsageSnapshot> {
  const record = (await pb.collection("users").getOne(userId)) as unknown as Record<
    string,
    unknown
  >;
  const tier = normalizeTier(record["tier"]);
  const currentPeriod = periodStartFor();

  if (periodHasRolledOver(record["billing_period_start"])) {
    await pb.collection("users").update(userId, {
      executions_used_this_month: 0,
      billing_period_start: currentPeriod,
    });
    return { userId, tier, executionsUsed: 0, billingPeriodStart: currentPeriod };
  }

  return {
    userId,
    tier,
    executionsUsed: safeUsage(record["executions_used_this_month"]),
    billingPeriodStart: String(record["billing_period_start"] ?? currentPeriod),
  };
}

async function countWorkflows(pb: PocketBase, userId: string, statuses: readonly string[]) {
  const statusFilter = statuses.map((s) => `status = '${s}'`).join(" || ");
  const list = await pb.collection("workflows").getFullList({
    filter: pb.filter(`user_id = {:userId} && (${statusFilter})`, { userId }),
    fields: "id",
  });
  return list.length;
}

async function findRunByExecutionId(pb: PocketBase, executionId: string) {
  try {
    return await pb
      .collection("workflow_runs")
      .getFirstListItem(pb.filter("execution_id = {:executionId}", { executionId }));
  } catch {
    return null;
  }
}

export interface StartExecutionInput {
  userId: string;
  workflowId: string;
  /** Stable run id from the execution engine. Retries MUST reuse it. */
  executionId: string;
  triggerType: string;
  inputData?: Record<string, unknown>;
  /** Test runs are metered separately and never consume an execution. */
  isTestRun?: boolean;
}

export interface StartExecutionResult {
  allowed: boolean;
  /** True only when this call incremented the monthly execution counter. */
  counted: boolean;
  /** True when the executionId was already known (a retry of the same run). */
  retry: boolean;
  runId?: string;
  executionId: string;
  message?: string;
  reason?: string;
  usage: { used: number; limit: number; tier: PlanTier };
}

/**
 * The single gate every execution must pass through. Called by the public
 * execution API (webhook/schedule/app event/form/incoming event) and by the
 * manual-run server function.
 */
export async function startExecution(input: StartExecutionInput): Promise<StartExecutionResult> {
  const pb = await adminClient();
  const workflow = (await pb.collection("workflows").getOne(input.workflowId)) as unknown as Record<
    string,
    unknown
  >;

  if (workflow["user_id"] !== input.userId) {
    throw new Error("Workflow does not belong to this account");
  }

  const usage = await loadUsage(pb, input.userId);
  const decision = checkExecutionAllowed(usage.tier, usage.executionsUsed);
  const usageView = { used: decision.used, limit: decision.limit, tier: decision.tier };

  // Retry of a run we already accounted for: same execution, no new usage.
  const existing = await findRunByExecutionId(pb, input.executionId);
  if (existing) {
    await pb.collection("workflow_runs").update(existing.id, {
      attempt_count: safeUsage((existing as unknown as Record<string, unknown>)["attempt_count"]) + 1,
      status: "running",
      error_message: "",
    });
    return {
      allowed: true,
      counted: false,
      retry: true,
      runId: existing.id,
      executionId: input.executionId,
      usage: usageView,
    };
  }

  // Draft workflows never execute automatically. Test runs are the only way to
  // exercise a draft and they are metered by the test path, not here.
  const status = String(workflow["status"] ?? "draft");
  if (!input.isTestRun && !(ACTIVE_WORKFLOW_STATUSES as readonly string[]).includes(status)) {
    return {
      allowed: false,
      counted: false,
      retry: false,
      executionId: input.executionId,
      reason: "workflow_not_active",
      message: "This workflow is not active, so it cannot be executed.",
      usage: usageView,
    };
  }

  if (input.isTestRun) {
    return {
      allowed: true,
      counted: false,
      retry: false,
      executionId: input.executionId,
      usage: usageView,
    };
  }

  if (!decision.allowed) {
    // Record the blocked attempt in the existing execution log.
    const blockedRun = await pb.collection("workflow_runs").create({
      workflow_id: input.workflowId,
      user_id: input.userId,
      execution_id: input.executionId,
      status: "blocked",
      trigger_type: input.triggerType,
      triggered_at: new Date().toISOString(),
      attempt_count: 1,
      counted: false,
      blocked_reason: decision.reason ?? "execution_limit_reached",
      input_data: JSON.stringify(input.inputData ?? {}),
      step_logs: JSON.stringify([]),
      error_message: EXECUTION_LIMIT_MESSAGE,
    });
    return {
      allowed: false,
      counted: false,
      retry: false,
      runId: blockedRun.id,
      executionId: input.executionId,
      reason: decision.reason ?? "execution_limit_reached",
      message: EXECUTION_LIMIT_MESSAGE,
      usage: usageView,
    };
  }

  // Allowed: count exactly one execution for the whole run, then open the log.
  await pb.collection("users").update(input.userId, {
    "executions_used_this_month+": 1,
    billing_period_start: usage.billingPeriodStart,
  });

  const run = await pb.collection("workflow_runs").create({
    workflow_id: input.workflowId,
    user_id: input.userId,
    execution_id: input.executionId,
    status: "running",
    trigger_type: input.triggerType,
    triggered_at: new Date().toISOString(),
    attempt_count: 1,
    counted: true,
    input_data: JSON.stringify(input.inputData ?? {}),
    step_logs: JSON.stringify([]),
  });

  await pb.collection("workflows").update(input.workflowId, {
    "run_count+": 1,
    last_run_at: new Date().toISOString(),
    last_run_status: "running",
  });

  return {
    allowed: true,
    counted: true,
    retry: false,
    runId: run.id,
    executionId: input.executionId,
    usage: { ...usageView, used: usageView.used + 1 },
  };
}

export interface CompleteExecutionInput {
  executionId: string;
  status: "success" | "failed";
  stepLogs?: unknown;
  outputData?: unknown;
  errorMessage?: string;
  durationMs?: number;
}

/**
 * Finalises a run. Never touches the execution counter: the execution was
 * already counted when it started, and a failure does not refund it.
 */
export async function completeExecution(input: CompleteExecutionInput) {
  const pb = await adminClient();
  const run = await findRunByExecutionId(pb, input.executionId);
  if (!run) return { ok: false, error: "unknown_execution" as const };

  await pb.collection("workflow_runs").update(run.id, {
    status: input.status,
    completed_at: new Date().toISOString(),
    duration_ms: input.durationMs ?? 0,
    step_logs: JSON.stringify(input.stepLogs ?? []),
    output_data: JSON.stringify(input.outputData ?? {}),
    error_message: input.errorMessage ?? "",
  });

  const workflowId = (run as unknown as Record<string, unknown>)["workflow_id"];
  if (typeof workflowId === "string" && workflowId) {
    await pb.collection("workflows").update(workflowId, { last_run_status: input.status });
  }
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Workflow, draft, step and workspace limits                          */
/* ------------------------------------------------------------------ */

export async function assertCanActivate(userId: string, workflowId: string) {
  const pb = await adminClient();
  const workflow = (await pb.collection("workflows").getOne(workflowId)) as unknown as Record<
    string,
    unknown
  >;
  if (workflow["user_id"] !== userId) throw new Error("Workflow does not belong to this account");

  const usage = await loadUsage(pb, userId);

  // Already active: activating again is a no-op and must not consume a slot.
  if ((ACTIVE_WORKFLOW_STATUSES as readonly string[]).includes(String(workflow["status"]))) {
    return { pb, workflow, decision: checkActivationAllowed(usage.tier, 0) };
  }

  const steps = countWorkflowSteps(parseBlocks(workflow["blocks"]));
  const stepDecision = checkStepsAllowed(usage.tier, steps);
  if (!stepDecision.allowed) return { pb, workflow, decision: stepDecision };

  const activeCount = await countWorkflows(pb, userId, ACTIVE_WORKFLOW_STATUSES);
  return { pb, workflow, decision: checkActivationAllowed(usage.tier, activeCount) };
}

export function parseBlocks(value: unknown): Array<{ type?: string }> {
  if (Array.isArray(value)) return value as Array<{ type?: string }>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as Array<{ type?: string }>) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export interface SaveGuardInput {
  userId: string;
  workflowId?: string;
  blocks: Array<{ type?: string }>;
  /** Target status of the save. */
  status: string;
}

/** Enforces step, draft and active limits for a create/update/duplicate save. */
export async function checkSaveAllowed(input: SaveGuardInput): Promise<LimitDecision> {
  const pb = await adminClient();
  const usage = await loadUsage(pb, input.userId);

  const stepDecision = checkStepsAllowed(usage.tier, countWorkflowSteps(input.blocks));
  if (!stepDecision.allowed) return stepDecision;

  const isActive = (ACTIVE_WORKFLOW_STATUSES as readonly string[]).includes(input.status);

  if (input.workflowId) {
    const existing = (await pb
      .collection("workflows")
      .getOne(input.workflowId)) as unknown as Record<string, unknown>;
    if (existing["user_id"] !== input.userId) {
      throw new Error("Workflow does not belong to this account");
    }
    const wasActive = (ACTIVE_WORKFLOW_STATUSES as readonly string[]).includes(
      String(existing["status"]),
    );
    // Only a transition into a new bucket can breach a limit.
    if (isActive && !wasActive) {
      return checkActivationAllowed(
        usage.tier,
        await countWorkflows(pb, input.userId, ACTIVE_WORKFLOW_STATUSES),
      );
    }
    return stepDecision;
  }

  return isActive
    ? checkActivationAllowed(
        usage.tier,
        await countWorkflows(pb, input.userId, ACTIVE_WORKFLOW_STATUSES),
      )
    : checkDraftAllowed(
        usage.tier,
        await countWorkflows(pb, input.userId, DRAFT_WORKFLOW_STATUSES),
      );
}

/** Enforces the one-workspace-per-plan rule. Seats are a separate limit. */
export async function checkWorkspaceCreationAllowed(userId: string): Promise<LimitDecision> {
  const pb = await adminClient();
  const usage = await loadUsage(pb, userId);
  const owned = await pb.collection("workspaces").getFullList({
    filter: pb.filter("owner_id = {:userId}", { userId }),
    fields: "id",
  });
  return checkWorkspaceAllowed(usage.tier, owned.length);
}
