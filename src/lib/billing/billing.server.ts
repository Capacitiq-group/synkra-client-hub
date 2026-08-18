/**
 * Billing engine (authoritative, server only).
 *
 * Guarantees:
 *   - Prices come from `@/lib/plans` via `./config`. Nothing is hardcoded here.
 *   - Every payment is verified against Paystack before anything is granted.
 *     A webhook body alone never grants a plan.
 *   - Settlement is idempotent: the same reference processed twice (webhook +
 *     return page + retry) produces exactly one payment row, one entitlement
 *     change and one welcome email.
 *   - Every webhook delivery is recorded in billing_events keyed by the
 *     provider event id, so replays are detected and skipped.
 *   - Entitlement changes always leave the buyer with a provisioned workspace
 *     in which they are the owner.
 *
 * SECURITY: Always use pb.filter() for user-supplied values. Never interpolate.
 */
import type PocketBase from "pocketbase";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { getPlanName, normalizeTier, type PlanTier } from "@/lib/plans";
import {
  CURRENCY,
  PROVIDER,
  isPurchasableTier,
  priceCents,
  type PurchasableTier,
} from "./config";
import { initializeTransaction, paystackConfigured, verifyTransaction } from "./paystack.server";
import { appUrl, magicLinkEmail, sendEmail, welcomeEmail } from "./email.server";

export const MAGIC_LINK_TTL_MINUTES = 30;

export class BillingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function str(record: Record<string, unknown> | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new BillingError("invalid_email", "Enter a valid email address.");
  }
  return email;
}

/** Hides most of the address so a leaked reference cannot expose an inbox. */
export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

async function findByField(pb: PocketBase, collection: string, field: string, value: string) {
  try {
    const record = await pb
      .collection(collection)
      .getFirstListItem(pb.filter(`${field} = {:value}`, { value }));
    return asRecord(record);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Finds the portal account for an email address, creating one when the buyer
 * is new. Never creates a duplicate: the email is the identity key.
 */
export async function resolveOrCreateUser(
  pb: PocketBase,
  input: { email: string; name?: string; phone?: string },
): Promise<{ userId: string; created: boolean; name: string }> {
  const existing = await findByField(pb, "users", "email", input.email);
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (input.name && !str(existing, "name")) patch["name"] = input.name;
    if (input.phone && !str(existing, "phone")) patch["phone"] = input.phone;
    if (Object.keys(patch).length > 0) {
      await pb.collection("users").update(str(existing, "id"), patch);
    }
    return {
      userId: str(existing, "id"),
      created: false,
      name: input.name || str(existing, "name"),
    };
  }

  // Password login is not used for these accounts — they sign in with a magic
  // link — so the password is random and never disclosed to anyone.
  const password = randomBytes(24).toString("base64url");
  const record = await pb.collection("users").create({
    email: input.email,
    emailVisibility: false,
    password,
    passwordConfirm: password,
    verified: true,
    name: input.name || input.email.split("@")[0],
    phone: input.phone ?? "",
    tier: "free",
    user_type: "paid",
    onboarding_completed: false,
    onboarding_step: 0,
  });
  return { userId: record.id, created: true, name: input.name || str(asRecord(record), "name") };
}

/* ------------------------------------------------------------------ */
/* Magic links                                                         */
/* ------------------------------------------------------------------ */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a single-use, short-lived sign-in link. Only the SHA-256 hash is
 * stored, so a database read cannot be replayed as a login. Any previously
 * issued unused link for the same user is invalidated first, so only the most
 * recent link can sign anybody in.
 */
export async function issueMagicLink(
  pb: PocketBase,
  input: { userId: string; email: string; purpose: string },
): Promise<string> {
  const now = new Date().toISOString();
  try {
    const outstanding = await pb.collection("magic_links").getFullList({
      filter: pb.filter("user_id = {:userId} && used_at = null", { userId: input.userId }),
    });
    for (const record of outstanding) {
      await pb.collection("magic_links").update(record.id, { used_at: now });
    }
  } catch {
    /* nothing outstanding, or the lookup failed: issuing a new link is still safe */
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000).toISOString();
  await pb.collection("magic_links").create({
    user_id: input.userId,
    email: input.email,
    token_hash: hashToken(token),
    purpose: input.purpose,
    expires_at: expiresAt,
  });
  return `${appUrl()}/auth/magic?token=${token}`;
}

/** Seconds a user must wait between sign-in link requests. */
export const MAGIC_LINK_COOLDOWN_SECONDS = 60;

/** True when the user asked for a link less than the cooldown ago. */
async function magicLinkOnCooldown(pb: PocketBase, userId: string): Promise<boolean> {
  try {
    const recent = await pb.collection("magic_links").getFullList({
      filter: pb.filter("user_id = {:userId}", { userId }),
      sort: "-created",
      perPage: 1,
    });
    const last = recent[0] as unknown as Record<string, unknown> | undefined;
    if (!last) return false;
    const created = new Date(str(last, "created").replace(" ", "T"));
    if (Number.isNaN(created.getTime())) return false;
    return Date.now() - created.getTime() < MAGIC_LINK_COOLDOWN_SECONDS * 1000;
  } catch {
    return false;
  }
}

/** Sends a sign-in link if — and only if — the address already has an account. */
export async function requestMagicLink(email: string): Promise<{ ok: true }> {
  const clean = normalizeEmail(email);
  const pb = await adminClient();
  const user = await findByField(pb, "users", "email", clean);
  // Always report success: the response must not reveal who has an account.
  if (user) {
    const userId = str(user, "id");
    if (!(await magicLinkOnCooldown(pb, userId))) {
      const link = await issueMagicLink(pb, { userId, email: clean, purpose: "login" });
      await sendEmail({ to: clean, ...magicLinkEmail(link, MAGIC_LINK_TTL_MINUTES) });
    }
  }
  return { ok: true };
}


export interface MagicLinkSession {
  token: string;
  record: Record<string, unknown>;
}

/**
 * Consumes a magic link and mints a real PocketBase session for the user.
 * The link is marked used before the session is issued, so a replay of the
 * same URL cannot produce a second session.
 */
export async function consumeMagicLink(token: string): Promise<MagicLinkSession> {
  if (!token || token.length < 32) throw new BillingError("invalid_token", "This link is invalid.");
  const pb = await adminClient();
  const record = await findByField(pb, "magic_links", "token_hash", hashToken(token));
  if (!record) throw new BillingError("invalid_token", "This sign-in link is not valid.");
  if (str(record, "used_at")) {
    throw new BillingError("already_used", "This sign-in link has already been used.");
  }
  const expiresAt = new Date(str(record, "expires_at").replace(" ", "T"));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new BillingError("expired", "This sign-in link has expired. Request a new one.");
  }

  await pb.collection("magic_links").update(str(record, "id"), { used_at: new Date().toISOString() });

  const userId = str(record, "user_id");
  const impersonated = await pb.collection("users").impersonate(userId, 60 * 60 * 24 * 7);
  const session = impersonated.authStore;
  if (!session.token || !session.record) {
    throw new BillingError("session_failed", "Could not start your session. Try signing in again.");
  }
  return { token: session.token, record: asRecord(session.record) };
}

/* ------------------------------------------------------------------ */
/* Entitlement                                                         */
/* ------------------------------------------------------------------ */

function addOneMonth(from: Date): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * Applies a paid tier to the account: user record, subscription row and a
 * provisioned workspace with the buyer as owner. Usage counters restart
 * because the paid billing period starts now.
 */
export async function applyEntitlement(
  pb: PocketBase,
  input: { userId: string; tier: PlanTier; reference: string },
) {
  const now = new Date();
  const periodEnd = addOneMonth(now);

  await pb.collection("users").update(input.userId, {
    tier: input.tier,
    user_type: "paid",
    billing_period_start: now.toISOString(),
    executions_used_this_month: 0,
    ai_ops_used_this_month: 0,
    emails_used_this_month: 0,
  });

  const existing = await findByField(pb, "billing_subscriptions", "user_id", input.userId);
  const payload = {
    user_id: input.userId,
    tier: input.tier,
    status: "active",
    provider: PROVIDER,
    last_reference: input.reference,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  };
  if (existing) {
    await pb.collection("billing_subscriptions").update(str(existing, "id"), payload);
  } else {
    await pb
      .collection("billing_subscriptions")
      .create({ ...payload, started_at: now.toISOString() });
  }

  const { ensureWorkspaceForOwner } = await import("@/lib/team/team.server");
  await ensureWorkspaceForOwner(input.userId);
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export interface CheckoutInput {
  email: string;
  name: string;
  phone?: string;
  tier: PurchasableTier | "free";
  source?: string;
}

export interface CheckoutResult {
  ok: true;
  reference: string;
  status: "pending" | "activated";
  authorizationUrl?: string;
  amountCents: number;
  tier: PlanTier;
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new BillingError("invalid_name", "Enter your name.");
  const tier = normalizeTier(input.tier);
  const pb = await adminClient();
  const reference = `SYN-${tier.toUpperCase()}-${randomUUID()}`;

  const { userId } = await resolveOrCreateUser(pb, {
    email,
    name,
    ...(input.phone ? { phone: input.phone } : {}),
  });

  await upsertCustomer(pb, { userId, email, name, ...(input.phone ? { phone: input.phone } : {}) });

  // The free plan costs nothing, so there is nothing to charge: provision the
  // account immediately and send the sign-in link.
  if (!isPurchasableTier(tier)) {
    await pb.collection("billing_checkouts").create({
      reference,
      user_id: userId,
      email,
      name,
      phone: input.phone ?? "",
      tier,
      amount_cents: 0,
      currency: CURRENCY,
      provider: "none",
      status: "activated",
      source: input.source ?? "web",
      paid_at: new Date().toISOString(),
    });
    await applyEntitlement(pb, { userId, tier, reference });
    const link = await issueMagicLink(pb, { userId, email, purpose: "welcome" });
    await sendEmail({ to: email, ...welcomeEmail(link, getPlanName(tier)) });
    return { ok: true, reference, status: "activated", amountCents: 0, tier };
  }

  if (!paystackConfigured()) {
    throw new BillingError("not_configured", "Card payments are not available right now.");
  }

  const amountCents = priceCents(tier);
  const checkout = await pb.collection("billing_checkouts").create({
    reference,
    user_id: userId,
    email,
    name,
    phone: input.phone ?? "",
    tier,
    amount_cents: amountCents,
    currency: CURRENCY,
    provider: PROVIDER,
    status: "pending",
    source: input.source ?? "web",
  });

  try {
    const init = await initializeTransaction({
      email,
      amountCents,
      reference,
      currency: CURRENCY,
      callbackUrl: `${appUrl()}/checkout/return?reference=${encodeURIComponent(reference)}`,
      metadata: { user_id: userId, tier, name },
    });
    await pb.collection("billing_checkouts").update(checkout.id, {
      authorization_url: init.authorization_url,
      access_code: init.access_code,
    });
    return {
      ok: true,
      reference,
      status: "pending",
      authorizationUrl: init.authorization_url,
      amountCents,
      tier,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the payment.";
    await pb
      .collection("billing_checkouts")
      .update(checkout.id, { status: "failed", error_message: message });
    throw new BillingError("provider_error", message);
  }
}

async function upsertCustomer(
  pb: PocketBase,
  input: { userId: string; email: string; name: string; phone?: string },
) {
  const existing = await findByField(pb, "billing_customers", "user_id", input.userId);
  const payload = {
    user_id: input.userId,
    email: input.email,
    name: input.name,
    phone: input.phone ?? "",
    provider: PROVIDER,
  };
  if (existing) await pb.collection("billing_customers").update(str(existing, "id"), payload);
  else await pb.collection("billing_customers").create(payload);
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export interface SettleResult {
  ok: boolean;
  status: "paid" | "failed" | "pending" | "unknown_reference";
  alreadySettled: boolean;
  tier?: PlanTier;
}

/**
 * Verifies a reference with Paystack and grants the plan. Safe to call any
 * number of times from any source (webhook, return page, manual retry).
 */
export async function settleTransaction(
  reference: string,
  source: "webhook" | "return" | "manual",
): Promise<SettleResult> {
  const pb = await adminClient();
  const checkout = await findByField(pb, "billing_checkouts", "reference", reference);
  if (!checkout) return { ok: false, status: "unknown_reference", alreadySettled: false };

  const tier = normalizeTier(checkout["tier"]);

  // Idempotency gate: a settled reference never re-grants or re-emails.
  if (str(checkout, "status") === "paid" || str(checkout, "status") === "activated") {
    return { ok: true, status: "paid", alreadySettled: true, tier };
  }

  const verification = await verifyTransaction(reference);
  if (verification.status !== "success") {
    await pb.collection("billing_checkouts").update(str(checkout, "id"), {
      status: verification.status === "abandoned" ? "pending" : "failed",
      error_message: `Paystack reported "${verification.status}".`,
    });
    return {
      ok: false,
      status: verification.status === "abandoned" ? "pending" : "failed",
      alreadySettled: false,
      tier,
    };
  }

  const expected = Number(checkout["amount_cents"] ?? 0);
  if (expected > 0 && verification.amount !== expected) {
    await pb.collection("billing_checkouts").update(str(checkout, "id"), {
      status: "failed",
      error_message: `Amount mismatch: charged ${verification.amount}, expected ${expected}.`,
    });
    return { ok: false, status: "failed", alreadySettled: false, tier };
  }

  const userId = str(checkout, "user_id");
  const email = str(checkout, "email");
  const paidAt = verification.paid_at ?? new Date().toISOString();

  // Unique index on reference makes this the real idempotency lock: a
  // concurrent webhook + return-page settlement cannot double-grant.
  const existingPayment = await findByField(pb, "billing_payments", "reference", reference);
  if (existingPayment) {
    await pb
      .collection("billing_checkouts")
      .update(str(checkout, "id"), { status: "paid", paid_at: paidAt });
    return { ok: true, status: "paid", alreadySettled: true, tier };
  }

  try {
    await pb.collection("billing_payments").create({
      reference,
      user_id: userId,
      checkout_id: str(checkout, "id"),
      tier,
      amount_cents: verification.amount,
      currency: verification.currency || CURRENCY,
      provider: PROVIDER,
      provider_transaction_id: String(verification.id ?? ""),
      status: "success",
      paid_at: paidAt,
      raw: JSON.stringify({ source, id: verification.id, status: verification.status }),
    });
  } catch {
    // Another settlement won the race and inserted the unique reference first.
    return { ok: true, status: "paid", alreadySettled: true, tier };
  }

  await applyEntitlement(pb, { userId, tier, reference });
  await pb.collection("billing_checkouts").update(str(checkout, "id"), {
    status: "paid",
    paid_at: paidAt,
    error_message: "",
  });

  if (email) {
    const link = await issueMagicLink(pb, { userId, email, purpose: "welcome" });
    await sendEmail({ to: email, ...welcomeEmail(link, getPlanName(tier)) });
  }

  return { ok: true, status: "paid", alreadySettled: false, tier };
}

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

export interface WebhookOutcome {
  ok: boolean;
  handled: boolean;
  duplicate: boolean;
  result: string;
}

/**
 * Records and processes one verified provider event. The event id is unique,
 * so a redelivered event is recognised and skipped instead of re-granting.
 */
export async function handleWebhookEvent(payload: {
  event?: string;
  data?: Record<string, unknown>;
}): Promise<WebhookOutcome> {
  const pb = await adminClient();
  const event = String(payload.event ?? "unknown");
  const data = payload.data ?? {};
  const reference = String(data["reference"] ?? "");
  const eventId = `${PROVIDER}:${event}:${String(data["id"] ?? (reference || randomUUID()))}`;

  const seen = await findByField(pb, "billing_events", "event_id", eventId);
  if (seen && seen["processed"]) {
    return { ok: true, handled: false, duplicate: true, result: "already_processed" };
  }

  const record =
    seen ??
    asRecord(
      await pb.collection("billing_events").create({
        event_id: eventId,
        provider: PROVIDER,
        type: event,
        reference,
        processed: false,
        payload: JSON.stringify(payload).slice(0, 20000),
      }),
    );

  let result = "ignored";
  let ok = true;
  try {
    if (event === "charge.success" && reference) {
      const settled = await settleTransaction(reference, "webhook");
      result = settled.alreadySettled ? "already_settled" : settled.status;
      ok = settled.ok;
    }
  } catch (err) {
    ok = false;
    result = err instanceof Error ? err.message.slice(0, 200) : "settle_failed";
  }

  await pb.collection("billing_events").update(str(record, "id"), {
    processed: true,
    processed_at: new Date().toISOString(),
    result,
  });

  return { ok, handled: result !== "ignored", duplicate: false, result };
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

export interface CheckoutStatus {
  found: boolean;
  status: string;
  tier: PlanTier;
  planName: string;
  amountCents: number;
  maskedEmail: string;
  /** True once the account is provisioned and the sign-in email has been sent. */
  activated: boolean;
}

/** Public read for the return page. Never exposes the full email address. */
export async function getCheckoutStatus(reference: string): Promise<CheckoutStatus> {
  const pb = await adminClient();
  const checkout = await findByField(pb, "billing_checkouts", "reference", reference);
  if (!checkout) {
    return {
      found: false,
      status: "unknown",
      tier: "free",
      planName: getPlanName("free"),
      amountCents: 0,
      maskedEmail: "",
      activated: false,
    };
  }
  const status = str(checkout, "status");
  const tier = normalizeTier(checkout["tier"]);
  return {
    found: true,
    status,
    tier,
    planName: getPlanName(tier),
    amountCents: Number(checkout["amount_cents"] ?? 0),
    maskedEmail: maskEmail(str(checkout, "email")),
    activated: status === "paid" || status === "activated",
  };
}

export interface BillingOverview {
  tier: PlanTier;
  planName: string;
  priceCents: number;
  subscription: {
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  payments: Array<{
    id: string;
    reference: string;
    amountCents: number;
    currency: string;
    status: string;
    paidAt: string;
    planName: string;
  }>;
}

/** Billing state for the signed-in account. */
export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const pb = await adminClient();
  const user = asRecord(await pb.collection("users").getOne(userId));
  const tier = normalizeTier(user["tier"]);
  const subscriptionRow = await findByField(pb, "billing_subscriptions", "user_id", userId);
  const paymentRows = await pb.collection("billing_payments").getFullList({
    filter: pb.filter("user_id = {:userId}", { userId }),
    sort: "-created",
  });

  return {
    tier,
    planName: getPlanName(tier),
    priceCents: priceCents(tier),
    subscription: subscriptionRow
      ? {
          status: str(subscriptionRow, "status"),
          currentPeriodStart: str(subscriptionRow, "current_period_start"),
          currentPeriodEnd: str(subscriptionRow, "current_period_end"),
        }
      : null,
    payments: paymentRows.map((raw) => {
      const row = asRecord(raw);
      return {
        id: str(row, "id"),
        reference: str(row, "reference"),
        amountCents: Number(row["amount_cents"] ?? 0),
        currency: str(row, "currency") || CURRENCY,
        status: str(row, "status"),
        paidAt: str(row, "paid_at") || str(row, "created"),
        planName: getPlanName(row["tier"]),
      };
    }),
  };
}
