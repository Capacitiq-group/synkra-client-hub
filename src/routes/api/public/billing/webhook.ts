/**
 * Paystack webhook receiver.
 *
 * The raw body is HMAC-SHA512 verified against the Paystack secret before any
 * processing, and every event is recorded by provider event id so a redelivery
 * is detected and skipped instead of granting a plan twice.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyWebhookSignature } = await import("@/lib/billing/paystack.server");
        try {
          if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Not configured", { status: 503 });
        }

        let payload: { event?: string; data?: Record<string, unknown> };
        try {
          payload = JSON.parse(raw) as { event?: string; data?: Record<string, unknown> };
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { handleWebhookEvent } = await import("@/lib/billing/billing.server");
        try {
          const outcome = await handleWebhookEvent(payload);
          // Always 200 on a processed event so Paystack stops retrying.
          return Response.json(outcome, { status: outcome.ok ? 200 : 500 });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "webhook_failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
