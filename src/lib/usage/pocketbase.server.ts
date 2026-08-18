/**
 * Server-side PocketBase access for usage accounting and limit enforcement.
 *
 * The browser must never be trusted with usage counters, so every counter read
 * and write goes through a superuser client created here. Credentials are read
 * from runtime env inside the functions (never at module scope) and never
 * shipped to the browser bundle.
 *
 * Failure modes are deliberately distinguishable in server logs — a missing
 * POCKETBASE_URL must never surface as "Not authenticated" — while the message
 * sent to the browser stays generic and never leaks configuration or secrets.
 */
import PocketBase from "pocketbase";

/** Thrown when the server itself is misconfigured. Never a user problem. */
export class PocketBaseConfigError extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    super(detail);
    this.name = "PocketBaseConfigError";
    this.code = code;
  }
  /** Safe to show a browser: no variable names, no values. */
  get publicMessage(): string {
    return "The server is not configured correctly. Please contact support.";
  }
}

/** Thrown when the caller's session is missing, invalid or expired. */
export class PocketBaseAuthError extends Error {
  readonly code: string;
  constructor(code: string, message = "Not authenticated") {
    super(message);
    this.name = "PocketBaseAuthError";
    this.code = code;
  }
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

/**
 * Resolves the PocketBase base URL. In production a missing POCKETBASE_URL is a
 * hard configuration error — it must never silently fall back to localhost.
 */
export function pocketbaseUrl(): string {
  const configured = process.env["POCKETBASE_URL"] || process.env["VITE_POCKETBASE_URL"] || "";
  if (!configured) {
    if (isProduction()) {
      throw new PocketBaseConfigError(
        "missing_pocketbase_url",
        "POCKETBASE_URL is not set. Refusing to fall back to http://127.0.0.1:8090 in production.",
      );
    }
    return "http://127.0.0.1:8090";
  }
  return configured.replace(/\/+$/, "");
}

function newClient(): PocketBase {
  const pb = new PocketBase(pocketbaseUrl());
  pb.autoCancellation(false);
  return pb;
}

function unreachable(err: unknown): PocketBaseConfigError {
  const detail = err instanceof Error ? err.message : String(err);
  return new PocketBaseConfigError("pocketbase_unreachable", `PocketBase is unreachable: ${detail}`);
}

/** True when a PocketBase client error is a transport failure, not an API rejection. */
function isTransportFailure(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === undefined || status === 0;
}

/** A superuser-authenticated PocketBase client. Server use only. */
export async function adminClient(): Promise<PocketBase> {
  const email = process.env["PB_ADMIN_EMAIL"] || "";
  const password = process.env["PB_ADMIN_PASSWORD"] || "";
  if (!email) {
    throw new PocketBaseConfigError("missing_pb_admin_email", "PB_ADMIN_EMAIL is not set.");
  }
  if (!password) {
    throw new PocketBaseConfigError("missing_pb_admin_password", "PB_ADMIN_PASSWORD is not set.");
  }

  const pb = newClient();
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
    return pb;
  } catch (superErr) {
    if (isTransportFailure(superErr)) throw unreachable(superErr);
    try {
      await (
        pb as unknown as {
          admins: { authWithPassword: (e: string, p: string) => Promise<unknown> };
        }
      ).admins.authWithPassword(email, password);
      return pb;
    } catch (adminErr) {
      if (isTransportFailure(adminErr)) throw unreachable(adminErr);
      throw new PocketBaseConfigError(
        "pb_admin_rejected",
        "PocketBase rejected the configured superuser credentials.",
      );
    }
  }
}

/**
 * Verifies a PocketBase auth token sent by the browser and returns the user id.
 * Used so client-initiated actions are enforced against the real account, not
 * an id the browser claims to own.
 *
 * Configuration problems propagate as PocketBaseConfigError; only a genuinely
 * bad session becomes PocketBaseAuthError.
 */
export async function verifyUserToken(token: string): Promise<{ userId: string }> {
  if (!token) throw new PocketBaseAuthError("missing_token");
  const pb = newClient(); // throws PocketBaseConfigError when the URL is missing
  pb.authStore.save(token, null);
  let record: { id?: string } | undefined;
  try {
    const result = await pb.collection("users").authRefresh();
    record = result.record as { id?: string } | undefined;
  } catch (err) {
    if (isTransportFailure(err)) throw unreachable(err);
    const status = (err as { status?: number }).status;
    if (status === 404) throw new PocketBaseAuthError("user_not_found", "Account not found.");
    if (status === 403) throw new PocketBaseAuthError("forbidden", "Access denied.");
    throw new PocketBaseAuthError("invalid_token", "Your session has expired. Please sign in again.");
  }
  if (!record?.id) throw new PocketBaseAuthError("user_not_found", "Account not found.");
  return { userId: record.id };
}
