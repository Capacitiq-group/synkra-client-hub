/**
 * Execution gate for the SYNKRA Flow execution engine (synkra-core).
 *
 * The engine MUST call this before it runs any step of a workflow. One call =
 * one workflow run = at most one counted execution. Retries reuse the same
 * execution_id and are never counted twice.
 *
 * Protected by the shared API secret; the browser can never reach it usefully.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EXECUTION_TRIGGERS } from "@/lib/usage/limits";

const schema = z.object({
  user_id: z.string().min(1),
  workflow_id: z.string().min(1),
  execution_id: z.string().min(1),
  trigger_type: z.enum(EXECUTION_TRIGGERS),
  input_data: z.record(z.unknown()).optional(),
  is_test_run: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/executions/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["API_SECRET"] || "";
        if (!secret || request.headers.get("x-synkra-secret") !== secret) {
          return Response.json({ allowed: false, error: "unauthorized" }, { status: 401 });
        }

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ allowed: false, error: "invalid_payload" }, { status: 400 });
        }

        const { startExecution } = await import("@/lib/usage/executions.server");
        try {
          const result = await startExecution({
            userId: parsed.data.user_id,
            workflowId: parsed.data.workflow_id,
            executionId: parsed.data.execution_id,
            triggerType: parsed.data.trigger_type,
            ...(parsed.data.input_data ? { inputData: parsed.data.input_data } : {}),
            ...(parsed.data.is_test_run ? { isTestRun: true } : {}),
          });
          // 402 tells the engine to stop: no partial execution is permitted.
          return Response.json(result, { status: result.allowed ? 200 : 402 });
        } catch (err) {
          return Response.json(
            { allowed: false, error: err instanceof Error ? err.message : "start_failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
