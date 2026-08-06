import { sendNotificationEmailFn } from "./notifications.functions";
import { logTelemetry } from "./telemetry";

export interface NotificationEmail {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Sends a notification email through the synkra-core API.
 * The request is proxied by our own server so the shared API secret is never
 * exposed in the browser bundle. Every attempt is recorded in telemetry so
 * delivery problems are visible from the Diagnostics panel.
 */
export async function sendNotificationEmail(params: NotificationEmail): Promise<boolean> {
  const started = Date.now();
  try {
    const result = await sendNotificationEmailFn({ data: params });
    const ok = Boolean(result?.ok);
    logTelemetry("notification", ok ? "info" : "error", ok ? "Email sent" : "Email rejected", {
      to: params.to,
      subject: params.subject,
      ms: Date.now() - started,
    });
    return ok;
  } catch (err) {
    logTelemetry("notification", "error", "Email request failed", {
      to: params.to,
      subject: params.subject,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    return false;
  }
}

const DEDUPE_KEY = "synkra-notified-runs";
const DEDUPE_LIMIT = 200;
const memoryDedupe = new Set<string>();

function readDedupe(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DEDUPE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Returns true the first time a notification key is seen and false afterwards,
 * so repeated realtime updates for the same failed run only send one email.
 */
export function claimNotification(key: string): boolean {
  if (memoryDedupe.has(key)) return false;
  memoryDedupe.add(key);
  const stored = readDedupe();
  if (stored.includes(key)) return false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DEDUPE_KEY, JSON.stringify([key, ...stored].slice(0, DEDUPE_LIMIT)));
    } catch {
      // best effort, in-memory guard still applies for this session
    }
  }
  return true;
}
