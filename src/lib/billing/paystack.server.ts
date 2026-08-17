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
