/**
 * Plan limits endpoint for the SYNKRA Flow execution engine (synkra-core).
 *
 * Returns PLAN_LIMITS verbatim — every tier, every field, no filtering — so
 * synkra-core can read plan limits from the hub without duplicating the numbers
 * in Python. src/lib/plans.ts stays the single source of truth.
 *
 * Read-only and protected by the same shared API secret as the execution
 * routes. No caching here: the caller (synkra-core) caches the response.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PLAN_LIMITS } from "@/lib/plans";

export const Route = createFileRoute("/api/public/plans")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["API_SECRET"] || "";
        if (!secret || request.headers.get("x-synkra-secret") !== secret) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        return Response.json(PLAN_LIMITS);
      },
    },
  },
});
