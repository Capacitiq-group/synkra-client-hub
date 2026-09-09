/**
 * Browser crash reporter.
 *
 * Blank screens and failed page scripts never reach the backend on their own:
 * the request that served the page succeeded, and the failure happens
 * afterwards in the browser. This posts those crashes to synkra-core's
 * receiver (`POST {VITE_API_URL}/client-errors/report`, see the core repo's
 * routers/client_errors.py), so they land in the same `error_logs` history and
 * the same email / in-app alerting as server-side failures.
 *
 * Rules this module holds itself to:
 *   * never throw — a reporter that crashes while reporting a crash is worse
 *     than no reporter at all;
 *   * never block rendering (fire and forget, `keepalive` so a report survives
 *     a navigation away from a broken page);
 *   * client-side rate limiting on top of the server's own limits, so a render
 *     loop cannot spray thousands of requests;
 *   * no payload beyond message/stack/url/user id — never form values, tokens
 *     or storage contents.
 */

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

const REPORT_URL = `${API_BASE.replace(/\/+$/, "")}/client-errors/report`;

/** Identical crashes are only sent again after this long. */
const DEDUPE_MS = 60_000;
/** Hard ceiling per page session, whatever happens. */
const MAX_PER_SESSION = 20;

const lastSent = new Map<string, number>();
let sentCount = 0;
let installed = false;

export interface ClientErrorReport {
  message: string;
  stack?: string;
  /** Where it came from: "window", "unhandledrejection", "react", ... */
  source?: string;
  url?: string;
  userId?: string;
}

function truncate(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.length <= limit ? value : value.slice(0, limit);
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    const described: { message: string; stack?: string } = {
      message: error.message || error.name,
    };
    if (error.stack) described.stack = error.stack;
    return described;
  }
  if (error instanceof Response) {
    return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` };
  }
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

function allowed(fingerprint: string): boolean {
  if (sentCount >= MAX_PER_SESSION) return false;
  const now = Date.now();
  const previous = lastSent.get(fingerprint);
  if (previous !== undefined && now - previous < DEDUPE_MS) return false;
  lastSent.set(fingerprint, now);
  sentCount += 1;
  return true;
}

function currentUserId(): string | undefined {
  try {
    const raw = localStorage.getItem("pocketbase_auth");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { model?: { id?: string }; record?: { id?: string } };
    return parsed.record?.id ?? parsed.model?.id;
  } catch {
    return undefined;
  }
}

/** Send one crash report. Safe to call from anywhere; never throws. */
export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  try {
    const message = truncate(report.message, 2000);
    if (!message) return;

    const source = report.source ?? "window";
    const fingerprint = `${source}|${message.slice(0, 300)}`;
    if (!allowed(fingerprint)) return;

    const body = {
      message,
      stack: truncate(report.stack, 8000) ?? null,
      source: truncate(source, 200),
      url: truncate(report.url ?? window.location.href, 1000),
      user_id: truncate(report.userId ?? currentUserId(), 100) ?? null,
      release: truncate(import.meta.env["VITE_RELEASE"] as string | undefined, 100) ?? null,
      user_agent: truncate(navigator.userAgent, 400),
    };

    void fetch(REPORT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "omit",
      mode: "cors",
    }).catch(() => {
      /* reporting must stay silent */
    });
  } catch {
    /* reporting must stay silent */
  }
}

/** Report an unknown thrown value (Error, Response, string, anything). */
export function reportCaughtError(error: unknown, source = "react"): void {
  const { message, stack } = describe(error);
  reportClientError({ message, source, ...(stack ? { stack } : {}) });
}

/**
 * Attach global listeners for uncaught errors and unhandled promise
 * rejections. Idempotent — safe to call on every mount.
 */
export function installClientErrorReporting(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    // Resource load failures (img/script) surface here with no `error`.
    const described = describe(event.error ?? event.message);
    reportClientError({
      message: described.message,
      source: "window",
      ...(described.stack ? { stack: described.stack } : {}),
      ...(event.filename ? { url: event.filename } : {}),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const described = describe(event.reason);
    reportClientError({
      message: described.message,
      source: "unhandledrejection",
      ...(described.stack ? { stack: described.stack } : {}),
    });
  });
}
