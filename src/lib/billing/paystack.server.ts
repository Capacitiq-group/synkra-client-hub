/**
 * Paystack REST client (server only).
 *
 * The secret key is read from runtime env inside each function, never at
 * module scope and never in a VITE_ variable, so it cannot reach the browser.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.paystack.co";

export function paystackSecret(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  if (!key) throw new Error("Payments are not configured on the server.");
  return key;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env["PAYSTACK_SECRET_KEY"]);
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: unknown }
    | null;
  if (!response.ok || !body || body.status === false) {
    throw new Error(body?.message || `Paystack request failed (${response.status}).`);
  }
  return body.data as T;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function initializeTransaction(input: {
  email: string;
  amountCents: number;
  reference: string;
  currency: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  /** When set, Paystack creates a recurring subscription on this plan. */
  plan?: string;
}): Promise<InitializeResult> {
  return call<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountCents,
      reference: input.reference,
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      ...(input.plan ? { plan: input.plan } : {}),
    }),
  });
}

export interface VerifyResult {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string;
  customer?: { email?: string; customer_code?: string };
  authorization?: { authorization_code?: string; reusable?: boolean };
  plan?: string | { plan_code?: string };
  metadata?: Record<string, unknown>;
}

export function verifyTransaction(reference: string): Promise<VerifyResult> {
  return call<VerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Paystack signs the raw request body with HMAC SHA512 using the secret key.
 * The comparison is timing-safe and the RAW body must be passed, not a
 * re-serialised object.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", paystackSecret()).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Plans & subscriptions (recurring billing)                           */
/* ------------------------------------------------------------------ */

export interface PaystackPlan {
  id: number;
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
  currency: string;
}

/** Deterministic plan name so the same tier+price always maps to one plan. */
export function planName(tier: string, amountCents: number, currency: string): string {
  return `SYNKRA ${tier.toUpperCase()} ${currency} ${amountCents} monthly`;
}

/**
 * Returns the Paystack plan for a tier+price, creating it the first time.
 * Paystack owns the recurring schedule, so a subscription is always attached
 * to one of these plans rather than to a bare transaction amount.
 */
export async function ensurePlan(input: {
  tier: string;
  amountCents: number;
  currency: string;
}): Promise<PaystackPlan> {
  const name = planName(input.tier, input.amountCents, input.currency);
  const existing = await call<PaystackPlan[]>(
    `/plan?perPage=100&status=active&amount=${input.amountCents}`,
  ).catch(() => [] as PaystackPlan[]);
  const match = existing.find((p) => p.name === name);
  if (match) return match;
  return call<PaystackPlan>("/plan", {
    method: "POST",
    body: JSON.stringify({
      name,
      amount: input.amountCents,
      interval: "monthly",
      currency: input.currency,
    }),
  });
}

export interface PaystackSubscription {
  id: number;
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date?: string | null;
  createdAt?: string;
  plan?: { plan_code?: string; amount?: number; name?: string };
  authorization?: { authorization_code?: string; reusable?: boolean };
  customer?: { customer_code?: string; email?: string };
}

export function fetchSubscription(code: string): Promise<PaystackSubscription> {
  return call<PaystackSubscription>(`/subscription/${encodeURIComponent(code)}`);
}

/**
 * Creates a subscription on the given plan. `startDate` is what makes a
 * scheduled plan change real on Paystack's side: the first charge for the new
 * plan happens then, never now.
 */
export function createSubscription(input: {
  customer: string;
  plan: string;
  authorization?: string;
  startDate?: string;
}): Promise<PaystackSubscription> {
  return call<PaystackSubscription>("/subscription", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customer,
      plan: input.plan,
      ...(input.authorization ? { authorization: input.authorization } : {}),
      ...(input.startDate ? { start_date: input.startDate } : {}),
    }),
  });
}

/** Stops a subscription renewing. The current period is never cut short. */
export function disableSubscription(input: { code: string; token: string }): Promise<unknown> {
  return call<unknown>("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: input.code, token: input.token }),
  });
}

export function enableSubscription(input: { code: string; token: string }): Promise<unknown> {
  return call<unknown>("/subscription/enable", {
    method: "POST",
    body: JSON.stringify({ code: input.code, token: input.token }),
  });
}

export interface PaystackCustomer {
  id: number;
  customer_code: string;
  email: string;
  authorizations?: Array<{
    authorization_code?: string;
    reusable?: boolean;
    channel?: string;
    signature?: string;
  }>;
  subscriptions?: PaystackSubscription[];
}

export function fetchCustomer(emailOrCode: string): Promise<PaystackCustomer> {
  return call<PaystackCustomer>(`/customer/${encodeURIComponent(emailOrCode)}`);
}

/** The most recent reusable card authorization for a customer, if any. */
export async function reusableAuthorization(emailOrCode: string): Promise<string> {
  const customer = await fetchCustomer(emailOrCode).catch(() => null);
  const auth = customer?.authorizations?.find((a) => a.reusable && a.authorization_code);
  return auth?.authorization_code ?? "";
}
