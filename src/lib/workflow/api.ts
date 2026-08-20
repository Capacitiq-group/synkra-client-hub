import type { WorkflowBlock } from "./types";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

export interface TestStepLog {
  block_id?: string;
  label?: string;
  success?: boolean;
  error?: string;
  output?: unknown;
  duration_ms?: number;
}

export interface TestRunResult {
  run_id?: string;
  status?: string;
  step_logs: TestStepLog[];
  error_message?: string;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function testWorkflow(
  blocks: WorkflowBlock[],
  sampleInput: Record<string, unknown>,
  userId: string,
): Promise<TestRunResult> {
  const response = await post("/workflows/test", {
    blocks,
    sample_input: sampleInput,
    user_id: userId,
  });
  if (!response.ok) throw new Error(`Test failed with status ${response.status}`);
  return (await response.json()) as TestRunResult;
}

export async function registerWorkflow(params: {
  workflowId: string;
  userId: string;
  blocks: WorkflowBlock[];
  trigger: { type: string; config: Record<string, unknown> };
}): Promise<{ status?: string; webhook_url?: string }> {
  const response = await post("/workflows/register", {
    workflow_id: params.workflowId,
    user_id: params.userId,
    blocks: params.blocks,
    trigger: params.trigger,
  });
  if (!response.ok) throw new Error(`Register failed with status ${response.status}`);
  return (await response.json()) as { status?: string; webhook_url?: string };
}

export function webhookUrlFor(workflowId: string): string {
  return `${API_BASE}/webhooks/run/${workflowId}`;
}

/**
 * Dedicated inbound address for a workflow's "Email received" trigger.
 * Mail forwarded here is delivered to the backend by Resend inbound.
 */
export function inboundEmailAddressFor(workflowId: string): string {
  return `flow-${workflowId}@in.synkra.co.za`;
}


export function integrationConnectUrl(
  type: "google-calendar" | "google-sheets" | "gmail",
  userId: string,
) {
  return `${API_BASE}/integrations/${type}/connect?user_id=${encodeURIComponent(userId)}`;
}

export async function testIntegration(type: string, userId: string): Promise<void> {
  const response = await post(`/integrations/${type}/test`, { user_id: userId });
  if (!response.ok) throw new Error(`Connection test failed with status ${response.status}`);
}

export async function disconnectIntegration(type: string, userId: string): Promise<void> {
  const response = await post(`/integrations/${type}/disconnect`, { user_id: userId });
  if (!response.ok) throw new Error(`Disconnect failed with status ${response.status}`);
}

/** Re-runs a workflow with the original trigger payload from a previous run. */
export async function retryRun(
  workflowId: string,
  inputData: Record<string, unknown>,
): Promise<void> {
  const response = await post(`/webhooks/run/${workflowId}`, inputData);
  if (!response.ok) throw new Error(`Retry failed with status ${response.status}`);
}
