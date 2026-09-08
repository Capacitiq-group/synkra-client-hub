/**
 * Constant-time comparison for shared secrets (API keys, header tokens).
 *
 * Plain `!==` leaks timing information proportional to how many leading
 * bytes match, which is exactly what `timingSafeEqual` exists to avoid.
 * `paystack.server.ts`'s `verifyWebhookSignature` already does this for the
 * Paystack HMAC; this is the same pattern for the internal shared-secret
 * routes (execution start/complete, plans, notifications test, checkout).
 */
import { timingSafeEqual } from "node:crypto";

export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
