import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

/**
 * Deploy smoke-test hook. Sends one notification email through synkra-core so
 * automated post-deploy checks can prove the delivery path works end to end.
 * Protected by the shared API secret: without a matching header the route
 * refuses to send.
 */
export const Route = createFileRoute("/api/public/notifications/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["API_SECRET"] || "";
        const provided = request.headers.get("x-synkra-secret") || "";
        if (!secret || provided !== secret) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }

        const apiUrl = process.env["API_URL"] || "https://api.synkra.co.za";
        try {
          const upstream = await fetch(`${apiUrl}/workflows/notifications/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Synkra-Secret": secret },
            body: JSON.stringify({
              to: parsed.data.to,
              subject: parsed.data.subject,
              body: parsed.data.body,
              from_name: "Synkra",
            }),
          });
          return Response.json({ ok: upstream.ok, status: upstream.status });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "upstream_failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
