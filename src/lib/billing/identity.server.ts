/**
 * Account identity + magic-link sign-in — SERVER ONLY.
 *
 * The PocketBase user id is the canonical internal identity for every billing
 * record. Email is only used to *find* an existing account during signup; it is
 * never the permanent relationship key.
 *
 * Magic links are single-use, hashed at rest, short lived and exchanged for a
 * real PocketBase auth token through the superuser impersonate endpoint — no
 * second authentication system is introduced.
 */
import { createHash, randomBytes } from "node:crypto";
import type PocketBase from "pocketbase";
import { MAGIC_LINK_TTL_MS } from "./config";

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

export function appUrl(): string {
  return (
    process.env["APP_URL"] ||
    process.env["VITE_APP_URL"] ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function str(record: Record<string, unknown> | null | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export async function findUserByEmail(
  pb: PocketBase,
  email: string,
): Promise<Record<string, unknown> | null> {
  try {
    const record = await pb
      .collection("users")
      .getFirstListItem(pb.filter("email = {:email}", { email }));
    return record as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Returns the canonical PocketBase user for a checkout. Never creates a second
 * account for the same person: an existing id wins, then the email lookup, and
 * only then is a new user created.
 *
 * New accounts are created with tier "free" — a paid tier is only ever applied
 * after a payment has been verified.
 */
export async function resolveOrCreateUser(
  pb: PocketBase,
  input: { userId?: string; email: string; name?: string; phone?: string },
): Promise<{ user: Record<string, unknown>; created: boolean }> {
  if (input.userId) {
    try {
      const existing = (await pb.collection("users").getOne(input.userId)) as unknown as Record<
        string,
        unknown
      >;
      return { user: existing, created: false };
    } catch {
      /* fall through to email lookup */
    }
  }
  const byEmail = await findUserByEmail(pb, input.email);
  if (byEmail) return { user: byEmail, created: false };

  // Password is required by the auth collection but is never shared: the
  // customer signs in through the magic link and can set a password later
  // through the existing password-reset flow.
  const password = randomBytes(24).toString("base64url");
  const created = (await pb.collection("users").create({
    email: input.email,
    password,
    passwordConfirm: password,
    emailVisibility: false,
    verified: true,
    name: input.name || input.email.split("@")[0],
    whatsapp_number: input.phone || "",
    user_type: "paid",
    tier: "free",
    credit_emails: 100,
    credit_emails_used: 0,
    credit_workflows: 2000,
    credit_workflows_used: 0,
    notify_on_failure: true,
    notify_weekly_summary: true,
    notify_on_success: false,
    notify_credit_low: true,
    notify_platform_updates: false,
  })) as unknown as Record<string, unknown>;
  return { user: created, created: true };
}

/**
 * Guarantees the account has its default workspace + owner membership, using
 * the existing workspace collections. Never creates a second workspace.
 */
export async function ensureDefaultWorkspace(
  pb: PocketBase,
  user: Record<string, unknown>,
): Promise<string> {
  const userId = str(user, "id");
  const owned = await pb.collection("workspaces").getFullList({
    filter: pb.filter("owner_id = {:userId}", { userId }),
    sort: "created",
  });
  let workspaceId = str(owned[0] as unknown as Record<string, unknown> | undefined, "id");
  if (!workspaceId) {
    const membership = await pb.collection("workspace_members").getFullList({
      filter: pb.filter("user_id = {:userId} && status = 'active'", { userId }),
      sort: "created",
    });
    const joined = membership[0] as unknown as Record<string, unknown> | undefined;
    if (joined) return str(joined, "workspace_id");

    const name = str(user, "business_name") || `${str(user, "name") || "My"} workspace`;
    const workspace = (await pb.collection("workspaces").create({
      owner_id: userId,
      name,
      is_default: true,
    })) as unknown as Record<string, unknown>;
    workspaceId = str(workspace, "id");
  }
  const existing = await pb
    .collection("workspace_members")
    .getFullList({
      filter: pb.filter("workspace_id = {:workspaceId} && user_id = {:userId}", {
        workspaceId,
        userId,
      }),
    })
    .catch(() => []);
  if (existing.length === 0) {
    await pb.collection("workspace_members").create({
      workspace_id: workspaceId,
      user_id: userId,
      email: str(user, "email"),
      name: str(user, "name"),
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });
  }
  return workspaceId;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a single-use magic link and returns its absolute URL. */
export async function createMagicLink(
  pb: PocketBase,
  input: { userId: string; email: string; purpose: string; checkoutRef?: string },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pb.collection("magic_links").create({
    user_id: input.userId,
    email: input.email,
    token_hash: hashToken(token),
    purpose: input.purpose,
    checkout_ref: input.checkoutRef || "",
    expires_at: new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString(),
  });
  return `${appUrl()}/auth/magic?token=${encodeURIComponent(token)}`;
}

export interface MagicLinkExchange {
  ok: boolean;
  error?: string;
  token?: string;
  userId?: string;
}

/**
 * Exchanges a magic-link token for a real PocketBase auth token. The link is
 * burned before the token is issued, so it cannot be replayed.
 */
export async function consumeMagicLink(pb: PocketBase, token: string): Promise<MagicLinkExchange> {
  if (!token || token.length < 20) return { ok: false, error: "invalid_link" };
  let record: Record<string, unknown>;
  try {
    record = (await pb
      .collection("magic_links")
      .getFirstListItem(
        pb.filter("token_hash = {:hash}", { hash: hashToken(token) }),
      )) as unknown as Record<string, unknown>;
  } catch {
    return { ok: false, error: "invalid_link" };
  }
  if (str(record, "used_at")) return { ok: false, error: "already_used" };
  const expires = new Date(str(record, "expires_at").replace(" ", "T")).getTime();
  if (!Number.isFinite(expires) || expires <= Date.now()) return { ok: false, error: "expired" };

  await pb.collection("magic_links").update(str(record, "id"), { used_at: new Date().toISOString() });

  const userId = str(record, "user_id");
  try {
    const impersonated = await pb.collection("users").impersonate(userId, 60 * 60 * 8);
    const authToken = (impersonated as unknown as { authStore: { token: string } }).authStore.token;
    if (!authToken) return { ok: false, error: "sign_in_failed" };
    return { ok: true, token: authToken, userId };
  } catch {
    return { ok: false, error: "sign_in_failed" };
  }
}
