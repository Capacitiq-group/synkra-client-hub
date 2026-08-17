/**
 * Execution completion callback for the SYNKRA Flow execution engine
 * (synkra-core). Called once the run has finished, successfully or not.
 *
 * This endpoint only finalises the run state and logs. It NEVER touches the
 * monthly execution counter: startExecution() already counted the run, and a
 * failure does not refund it.
 *
 * Auth, request shape and error conventions mirror ./start.ts exactly so
 * synkra-core can call both endpoints the same way.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  execution_id: z.string().min(1),
  status: z.enum(["success", "failed"]),
  step_logs: z.unknown().optional(),
  output_data: z.unknown().optional(),
  error_message: z.string().max(4000).optional(),
  duration_ms: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/api/public/executions/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["API_SECRET"] || "";
        if (!secret || request.headers.get("x-synkra-secret") !== secret) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
        }

        const { completeExecution } = await import("@/lib/usage/executions.server");
        try {
          const result = await completeExecution({
            executionId: parsed.data.execution_id,
            status: parsed.data.status,
            ...(parsed.data.step_logs !== undefined ? { stepLogs: parsed.data.step_logs } : {}),
            ...(parsed.data.output_data !== undefined
              ? { outputData: parsed.data.output_data }
              : {}),
            ...(parsed.data.error_message ? { errorMessage: parsed.data.error_message } : {}),
            ...(parsed.data.duration_ms !== undefined
              ? { durationMs: parsed.data.duration_ms }
              : {}),
          });
          // The run was never started (or its execution_id is unknown), so
          // there is nothing to finalise: 404, not a server error.
          if (!result.ok) {
            return Response.json(
              { ok: false, error: result.error ?? "unknown_execution" },
              { status: 404 },
            );
          }
          return Response.json({ ok: true, execution_id: parsed.data.execution_id });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "complete_failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
