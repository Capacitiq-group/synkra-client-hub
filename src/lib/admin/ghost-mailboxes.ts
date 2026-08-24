// INTERNAL TOOL — not part of the customer-facing product surface.
// Every call must carry the signed-in user's real PocketBase auth token; the
// backend derives the owning user from that token, never from a request field.
import pb from "@/lib/pocketbase";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

export const GHOST_MAILBOX_DOMAIN = "in.synkra.co.za";

export interface GhostMailbox {
  id: string;
  address?: string;
  local_part?: string;
  forward_to?: string;
  created?: string;
}

function authHeaders(): HeadersInit {
  const token = pb.authStore.token;
  if (!token) throw new Error("You are signed out. Sign in again to use this tool.");
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Normalises the various shapes the API may return into a flat list. */
export async function listGhostMailboxes(): Promise<GhostMailbox[]> {
  const data = await request<unknown>("/ghost-mailboxes");
  if (Array.isArray(data)) return data as GhostMailbox[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["mailboxes", "items", "data", "results"]) {
      if (Array.isArray(record[key])) return record[key] as GhostMailbox[];
    }
  }
  return [];
}

export async function createGhostMailbox(params: {
  localPart: string;
  forwardTo: string;
}): Promise<GhostMailbox | undefined> {
  const localPart = params.localPart.trim().toLowerCase();
  return request<GhostMailbox>("/ghost-mailboxes", {
    method: "POST",
    body: JSON.stringify({
      local_part: localPart,
      address: `${localPart}@${GHOST_MAILBOX_DOMAIN}`,
      forward_to: params.forwardTo.trim(),
    }),
  });
}

export async function deleteGhostMailbox(id: string): Promise<void> {
  await request<void>(`/ghost-mailboxes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function sendFromGhostMailbox(params: {
  mailboxId: string;
  from?: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  await request<void>("/ghost-mailboxes/send", {
    method: "POST",
    body: JSON.stringify({
      mailbox_id: params.mailboxId,
      ...(params.from ? { from: params.from } : {}),
      to: params.to.trim(),
      subject: params.subject,
      body: params.body,
    }),
  });
}
