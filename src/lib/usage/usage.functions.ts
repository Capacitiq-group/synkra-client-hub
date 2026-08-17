/**
 * Client-callable entry points for usage accounting and limit enforcement.
 *
 * The browser may display limits, but these server functions are the actual
 * protection: they re-verify the caller's PocketBase token and re-read usage
 * from the database before allowing anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10) });

const activateSchema = tokenSchema.extend({ workflowId: z.string().min(1) });

const saveSchema = tokenSchema.extend({
  workflowId: z.string().min(1).optional(),
  blocks: z.array(z.object({ type: z.string().optional() }).passthrough()),
  status: z.enum(["draft", "published", "paused", "error"]),
});

const manualRunSchema = tokenSchema.extend({
  workflowId: z.string().min(1),
  executionId: z.string().min(1).optional(),
  inputData: z.record(z.unknown()).optional(),
});

const workspaceSchema = tokenSchema.extend({ name: z.string().min(1).max(120) });

/** Current tier + monthly execution usage, read server-side. */
export const getUsageSnapshotFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken, adminClient } = await import("./pocketbase.server");
    const { loadUsage } = await import("./executions.server");
    const { userId } = await verifyUserToken(data.token);
    const pb = await adminClient();
    const usage = await loadUsage(pb, userId);
    const { getPlanLimits } = await import("@/lib/plans");
    return { ...usage, limits: getPlanLimits(usage.tier) };
  });

/** Enforced activation: checks step + active workflow limits, then publishes. */
export const activateWorkflowFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => activateSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("./pocketbase.server");
    const { assertCanActivate } = await import("./executions.server");
    const { userId } = await verifyUserToken(data.token);
    const { pb, decision } = await assertCanActivate(userId, data.workflowId);
    if (!decision.allowed) {
      return { ok: false as const, message: decision.message, reason: decision.reason };
    }
    await pb.collection("workflows").update(data.workflowId, { status: "published" });
    return { ok: true as const };
  });

/** Enforced save: step limit always, draft/active limits on the target bucket. */
export const checkWorkflowSaveFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("./pocketbase.server");
    const { checkSaveAllowed } = await import("./executions.server");
    const { userId } = await verifyUserToken(data.token);
    const decision = await checkSaveAllowed({
      userId,
      ...(data.workflowId ? { workflowId: data.workflowId } : {}),
      blocks: data.blocks.map((b) => ({ type: typeof b["type"] === "string" ? b["type"] : "" })),
      status: data.status,
    });
    return {
      ok: decision.allowed,
      message: decision.message,
      reason: decision.reason,
      used: decision.used,
      limit: decision.limit,
    };
  });

/** Manual execution of an active workflow, gated by the monthly limit. */
export const startManualExecutionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => manualRunSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("./pocketbase.server");
    const { startExecution } = await import("./executions.server");
    const { userId } = await verifyUserToken(data.token);
    const result = await startExecution({
      userId,
      workflowId: data.workflowId,
      executionId: data.executionId ?? crypto.randomUUID(),
      triggerType: "manual",
      ...(data.inputData ? { inputData: data.inputData } : {}),
    });
    return result;
  });

/** One workspace per plan. Seats/team members are a separate limit. */
export const createWorkspaceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => workspaceSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken, adminClient } = await import("./pocketbase.server");
    const { checkWorkspaceCreationAllowed } = await import("./executions.server");
    const { userId } = await verifyUserToken(data.token);
    const decision = await checkWorkspaceCreationAllowed(userId);
    if (!decision.allowed) {
      return { ok: false as const, message: decision.message, reason: decision.reason };
    }
    const pb = await adminClient();
    const record = await pb.collection("workspaces").create({
      owner_id: userId,
      name: data.name,
      is_default: decision.used === 0,
    });
    return { ok: true as const, workspaceId: record.id };
  });
