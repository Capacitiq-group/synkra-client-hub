/**
 * Execution completion callback for the SYNKRA Flow execution engine.
 *
 * Finalises a run that was opened by /api/public/executions/start. It never
 * touches the monthly execution counter: the execution was counted once at
 * start, a failure does not refund it, and a retry reuses the same
 * execution_id, so completion can be delivered more than once safely.
 *
 * Protected by the same shared API secret as the start route.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  execution_id: z.string().min(1),
  status: z.enum(["success", "failed"]),
  step_logs: z.unknown().optional(),
  output_data: z.unknown().optional(),
  error_message: z.string().max(4000).optional(),
  duration_ms: z.number().int().nonnegative().max(86_400_000).optional(),
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
          return Response.json(result, { status: result.ok ? 200 : 404 });
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
