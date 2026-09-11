/**
 * Scheduled job: applies every plan change whose billing date has arrived.
 *
 * Paystack webhooks normally apply a change the moment the renewal lands; this
 * endpoint is the safety net for accounts whose event was missed. Protected by
 * the shared API secret and idempotent — an applied change is never reapplied.
 */
import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/security";

async function run(request: Request): Promise<Response> {
  const secret = process.env["API_SECRET"] || "";
  if (!secretsMatch(request.headers.get("x-synkra-secret"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { applyDuePlanChanges } = await import("@/lib/billing/plan-changes.server");
  try {
    const result = await applyDuePlanChanges();
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "apply_failed" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/billing/apply-plan-changes")({
  server: { handlers: { POST: ({ request }) => run(request), GET: ({ request }) => run(request) } },
});
