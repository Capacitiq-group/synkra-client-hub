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
 * Dedicated inbound address for an account's "Email received" triggers.
 * Deterministic per user — mail forwarded here is delivered by Resend inbound.
 */
export function inboundEmailAddressForUser(userId: string): string {
  return `flow-${userId}@in.synkra.co.za`;
}


export function integrationConnectUrl(type: "hubspot", userId: string) {
  return `${API_BASE}/integrations/${type}/connect?user_id=${encodeURIComponent(userId)}`;
}

/**
 * Slack connect flow (Nango-hosted). Step 1: ask our own backend for a Nango
 * Connect session token. The popup is opened by the caller with the SDK.
 */
export async function createSlackConnectSession(userId: string): Promise<string> {
  const response = await post("/integrations/slack/connect", { user_id: userId });
  if (!response.ok) throw new Error(`Slack connect failed with status ${response.status}`);
  const data = (await response.json()) as { session_token?: string };
  if (!data.session_token) throw new Error("Slack connect did not return a session token");
  return data.session_token;
}

/**
 * Step 2: called after the popup reports "connect". This endpoint both confirms
 * the connection and is what persists our own `integrations` record
 * (status "connected" + the Slack workspace name) — the frontend saves nothing.
 */
export async function fetchSlackStatus(
  userId: string,
): Promise<{ connected: boolean; team_name?: string }> {
  const response = await post("/integrations/slack/status", { user_id: userId });
  if (!response.ok) throw new Error(`Slack status failed with status ${response.status}`);
  return (await response.json()) as { connected: boolean; team_name?: string };
}

export interface SlackChannel {
  id: string;
  name: string;
}

/** Only channels the Synkra Slack bot has been added to are returned. */
export async function fetchSlackChannels(userId: string): Promise<SlackChannel[]> {
  const response = await fetch(
    `${API_BASE}/integrations/slack/channels?user_id=${encodeURIComponent(userId)}`,
  );
  if (!response.ok) throw new Error(`Slack channels failed with status ${response.status}`);
  const data = (await response.json()) as { channels?: SlackChannel[] };
  return data.channels ?? [];
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
  
