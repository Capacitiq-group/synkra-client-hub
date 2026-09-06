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
 * Tally-specific webhook receiver. Unlike the generic webhookUrlFor()
 * above, this endpoint builds context = {"trigger": trigger_context,
 * "user": user} rather than context = {"payload": payload, "user": user},
 * so Tally triggers must be pointed here instead of the generic receiver.
 */
export function tallyWebhookUrlFor(workflowId: string): string {
  return `${API_BASE}/webhooks/tally/${workflowId}`;
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
  provider: string,
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

/**
 * Generic connect flow (Nango-hosted) for every launch integration built
 * with routers/oauth_integration_factory.py on the backend — Shopify,
 * Typeform, Calendly, Xero, Airtable, Monday.com, Asana, Pipedrive.
 * Same two-step shape as the Slack/Zoho functions above (session token,
 * then a /status call once the popup reports success), just parametrized
 * by provider instead of one copy per platform. See
 * components/integrations/generic-connect.tsx for the popup wiring.
 */
export async function createProviderConnectSession(provider: string, userId: string): Promise<string> {
  const response = await post(`/integrations/${provider}/connect`, { user_id: userId });
  if (!response.ok) throw new Error(`${provider} connect failed with status ${response.status}`);
  const data = (await response.json()) as { session_token?: string };
  if (!data.session_token) throw new Error(`${provider} connect did not return a session token`);
  return data.session_token;
}

export async function fetchProviderStatus(
  provider: string,
  userId: string,
): Promise<{ connected: boolean; display_name?: string; scopes?: string[] }> {
  const response = await post(`/integrations/${provider}/status`, { user_id: userId });
  if (!response.ok) throw new Error(`${provider} status failed with status ${response.status}`);
  return (await response.json()) as { connected: boolean; display_name?: string; scopes?: string[] };
}

/**
 * Tally's connect flow is not OAuth — the user pastes an API key, which
 * is verified against a live Tally call before being stored (see
 * routers/integrations_tally.py). No popup, no session token.
 */
export async function connectTallyApiKey(
  userId: string,
  apiKey: string,
): Promise<{ connected: boolean; display_name?: string }> {
  const response = await post("/integrations/tally/connect", { user_id: userId, api_key: apiKey });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail || `Tally connect failed with status ${response.status}`);
  }
  return (await response.json()) as { connected: boolean; display_name?: string };
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

// ClickUp/Notion connect/status/test/disconnect/reauthorize all go through
// the generic createProviderConnectSession/fetchProviderStatus functions
// above (see generic-connect.tsx) — both platforms are factory-based now,
// same as Shopify/Airtable/etc. Only their provider-specific picker
// endpoints need dedicated functions here.

export interface ClickupSpace {
  id: string;
  name: string;
}

export interface ClickupList {
  id: string;
  name: string;
  folder: string | null;
}

/** Populates the two-step "which ClickUp list?" picker in the workflow config UI. */
export async function fetchClickupSpaces(userId: string): Promise<ClickupSpace[]> {
  const response = await fetch(`${API_BASE}/integrations/clickup/spaces?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error(`ClickUp spaces failed with status ${response.status}`);
  const data = (await response.json()) as { spaces?: ClickupSpace[] };
  return data.spaces ?? [];
}

export async function fetchClickupLists(userId: string, spaceId: string): Promise<ClickupList[]> {
  const response = await fetch(
    `${API_BASE}/integrations/clickup/lists?user_id=${encodeURIComponent(userId)}&space_id=${encodeURIComponent(spaceId)}`,
  );
  if (!response.ok) throw new Error(`ClickUp lists failed with status ${response.status}`);
  const data = (await response.json()) as { lists?: ClickupList[] };
  return data.lists ?? [];
}

/**
 * Called once, right after a workflow with a "New ClickUp event" trigger
 * is published — idempotent, safe to call every publish.
 */
export async function ensureClickupWebhook(userId: string): Promise<{ status: string }> {
  const response = await post("/integrations/clickup/webhooks/ensure", { user_id: userId });
  if (!response.ok) throw new Error(`ClickUp webhook setup failed with status ${response.status}`);
  return (await response.json()) as { status: string };
}

/**
 * Called once, right after a workflow with an "Asana task reaches a
 * stage" trigger is published — idempotent per (userId, projectGid)
 * pair, safe to call every publish. Unlike ClickUp's single
 * account-wide webhook, Asana webhooks are registered per-project, so
 * a call for a different projectGid on the same account registers a
 * second webhook rather than being treated as already done.
 */
export async function ensureAsanaWebhook(
  userId: string,
  projectGid: string,
): Promise<{ status: string }> {
  const response = await post("/integrations/asana/webhooks/ensure", {
    user_id: userId,
    project_gid: projectGid,
  });
  if (!response.ok) throw new Error(`Asana webhook setup failed with status ${response.status}`);
  return (await response.json()) as { status: string };
}

/**
 * Called once, right after a workflow with a "Monday.com item or
 * update changed" trigger is published — idempotent per (userId,
 * boardId) pair, same reasoning as ensureAsanaWebhook above (Monday
 * webhooks are per-board, not per-account).
 */
export async function ensureMondayWebhook(
  userId: string,
  boardId: string,
): Promise<{ status: string }> {
  const response = await post("/integrations/monday/webhooks/ensure", {
    user_id: userId,
    board_id: boardId,
  });
  if (!response.ok) throw new Error(`Monday webhook setup failed with status ${response.status}`);
  return (await response.json()) as { status: string };
}

/**
 * Called once, right after a workflow with a "New Typeform response"
 * trigger is published — idempotent per (userId, formId) pair, same
 * reasoning as ensureAsanaWebhook above (Typeform webhooks are
 * per-form, not per-account).
 */
export async function ensureTypeformWebhook(
  userId: string,
  formId: string,
): Promise<{ status: string }> {
  const response = await post("/integrations/typeform/webhooks/ensure", {
    user_id: userId,
    form_id: formId,
  });
  if (!response.ok) throw new Error(`Typeform webhook setup failed with status ${response.status}`);
  return (await response.json()) as { status: string };
}

export interface NotionDatabase {
  id: string;
  title: string;
  url?: string;
}

/**
 * Populates the "which Notion database?" picker. An empty array here
 * usually means the account hasn't shared a database with the Synkra
 * Notion integration yet — the frontend should explain that, not treat
 * it as an error (see integrations_notion.py's /databases docstring).
 */
export async function fetchNotionDatabases(userId: string): Promise<NotionDatabase[]> {
  const response = await fetch(`${API_BASE}/integrations/notion/databases?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error(`Notion databases failed with status ${response.status}`);
  const data = (await response.json()) as { databases?: NotionDatabase[] };
  return data.databases ?? [];
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
