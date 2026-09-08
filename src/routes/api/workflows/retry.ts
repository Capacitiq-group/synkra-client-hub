/**
 * Authenticated re-run of a previous workflow run.
 *
 * The browser used to POST straight to synkra-core's public webhook receiver
 * (/webhooks/run/{id}), which is unauthenticated by design (third parties call
 * it) and only accepts *published* workflows — so retry both let anyone with a
 * workflow id trigger a real run, and 404'd for paused or errored workflows,
 * which is exactly when you want to retry.
 *
 * This route verifies the signed-in user actually owns the workflow, then
 * forwards to core's authenticated /webhooks/run/{id}/retry with the shared
 * secret. The secret never reaches the browser.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  workflow_id: z.string().min(1),
  input_data: z.record(z.unknown()).optional(),
});

export const Route = createFileRoute("/api/workflows/retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "invalid_payload" }, { status: 400 });
        }

        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        const { verifyUserToken, adminClient } = await import("@/lib/usage/pocketbase.server");

        let userId: string;
        try {
          ({ userId } = await verifyUserToken(token));
        } catch {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let workflow: { user_id?: string } | null = null;
        try {
          const pb = await adminClient();
          workflow = await pb
            .collection("workflows")
            .getOne<{ user_id?: string }>(parsed.data.workflow_id);
        } catch {
          return Response.json({ error: "workflow_not_found" }, { status: 404 });
        }

        if (!workflow || workflow.user_id !== userId) {
          // Don't confirm existence of workflows the caller doesn't own.
          return Response.json({ error: "workflow_not_found" }, { status: 404 });
        }

        const coreUrl = (process.env["CORE_API_URL"] || "https://api.synkra.co.za").replace(
          /\/+$/,
          "",
        );
        const secret = process.env["WEBHOOK_SECRET"] || process.env["API_SECRET"] || "";

        try {
          const upstream = await fetch(
            `${coreUrl}/webhooks/run/${encodeURIComponent(parsed.data.workflow_id)}/retry`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-synkra-secret": secret,
              },
              body: JSON.stringify(parsed.data.input_data ?? {}),
            },
          );
          const text = await upstream.text();
          return new Response(text || "{}", {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "retry_failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
