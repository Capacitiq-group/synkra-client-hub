/**
 * Paystack HTTP integration — SERVER ONLY.
 *
 * Paystack was not previously implemented in this platform; this module is the
 * only place that talks to Paystack. No SDK is installed: the REST API is
 * called directly with fetch, which the existing server runtime already
 * supports.
 *
 * PAYSTACK_SECRET_KEY is read inside the functions (never at module scope) and
 * never reaches the browser bundle.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackError";
  }
}

function secretKey(): string {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  if (!key) throw new PaystackError("Payments are not configured on the server.");
  return key;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env["PAYSTACK_SECRET_KEY"]);
}

/** True when the configured key is a Paystack test-mode key. */
export function paystackTestMode(): boolean {
  return (process.env["PAYSTACK_SECRET_KEY"] || "").startsWith("sk_test_");
}

async function paystackRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const json = (await response.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: unknown }
    | null;
  if (!response.ok || !json || json.status !== true) {
    throw new PaystackError(json?.message || `Paystack request failed (${response.status})`);
  }
  return json.data as T;
}

/** Unpredictable, non-sensitive transaction reference. */
export function generateReference(): string {
  return `SYN-${Date.now().toString(36).toUpperCase()}-${randomBytes(12).toString("hex")}`;
}

export interface InitializeInput {
  email: string;
  /** Amount in the minor unit (cents). Always resolved server-side. */
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function initializeTransaction(input: InitializeInput): Promise<InitializeResult> {
  return paystackRequest<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    },
  });
}

export interface VerifyResult {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  channel?: string;
  gateway_response?: string;
  customer?: { id?: number; email?: string; customer_code?: string };
  metadata?: Record<string, unknown> | string | null;
}

export function verifyTransaction(reference: string): Promise<VerifyResult> {
  return paystackRequest<VerifyResult>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

/**
 * Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret
 * key. Compared in constant time; an unsigned or mismatched body is rejected.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  let expected: string;
  try {
    expected = createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");
  } catch {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
