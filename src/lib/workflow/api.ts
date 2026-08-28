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


/**
 * HubSpot connect flow (Nango-hosted) — same shape as the Slack functions
 * below. Replaces the old redirect-based integrationConnectUrl()/GET
 * /integrations/hubspot/connect, which no longer exists now that HubSpot
 * is on Nango too (see routers/integrations_hubspot.py).
 */
export async function createHubspotConnectSession(userId: string): Promise<string> {
  const response = await post("/integrations/hubspot/connect", { user_id: userId });
  if (!response.ok) throw new Error(`HubSpot connect failed with status ${response.status}`);
  const data = (await response.json()) as { session_token?: string };
  if (!data.session_token) throw new Error("HubSpot connect did not return a session token");
  return data.session_token;
}

export async function fetchHubspotStatus(
  userId: string,
): Promise<{ connected: boolean; portal_id?: number; scopes?: string[] }> {
  const response = await post("/integrations/hubspot/status", { user_id: userId });
  if (!response.ok) throw new Error(`HubSpot status failed with status ${response.status}`);
  return (await response.json()) as { connected: boolean; portal_id?: number; scopes?: string[] };
}

/**
 * Starts a reauthorize session for an already-connected platform,
 * requesting additional scopes on top of what's currently granted — used
 * when a workflow block needs a scope the connection doesn't have yet.
 * `provider` must be a platform whose router exposes a /reauthorize
 * endpoint (currently: hubspot — zoho doesn't have one yet).
 */
export async function createReauthorizeSession(
  provider: "hubspot" | "zoho",
  userId: string,
  additionalScopes: string[],
): Promise<string> {
  const response = await post(`/integrations/${provider}/reauthorize`, {
    user_id: userId,
    additional_scopes: additionalScopes,
  });
  if (!response.ok) throw new Error(`Reauthorize failed with status ${response.status}`);
  const data = (await response.json()) as { session_token?: string };
  if (!data.session_token) throw new Error("Reauthorize did not return a session token");
  return data.session_token;
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

/**
 * Zoho Books connect flow (Nango-hosted) — identical shape to the Slack
 * flow above, just a different provider_config_key server-side. See
 * components/integrations/zoho-connect.tsx for the popup wiring.
 */
export async function createZohoConnectSession(userId: string): Promise<string> {
  const response = await post("/integrations/zoho/connect", { user_id: userId });
  if (!response.ok) throw new Error(`Zoho connect failed with status ${response.status}`);
  const data = (await response.json()) as { session_token?: string };
  if (!data.session_token) throw new Error("Zoho connect did not return a session token");
  return data.session_token;
}

export async function fetchZohoStatus(
  userId: string,
): Promise<{ connected: boolean; organization_name?: string }> {
  const response = await post("/integrations/zoho/status", { user_id: userId });
  if (!response.ok) throw new Error(`Zoho status failed with status ${response.status}`);
  return (await response.json()) as { connected: boolean; organization_name?: string };
}

export interface PendingApproval {
  id: string;
  type: string;
  status: string;
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string;
}

export async function approvePendingAction(approvalId: string, userId: string): Promise<{ status: string }> {
  const response = await post(`/integrations/zoho/approvals/${approvalId}/approve`, { user_id: userId });
  if (!response.ok) throw new Error(`Approve failed with status ${response.status}`);
  return (await response.json()) as { status: string };
}

export async function rejectPendingAction(approvalId: string, userId: string): Promise<{ status: string }> {
  const response = await post(`/integrations/zoho/approvals/${approvalId}/reject`, { user_id: userId });
  if (!response.ok) throw new Error(`Reject failed with status ${response.status}`);
  return (await response.json()) as { status: string };
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
  
