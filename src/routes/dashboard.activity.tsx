import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/activity")({
  validateSearch: (search: Record<string, unknown>): { workflow?: string; run?: string } => ({
    ...(typeof search["workflow"] === "string" ? { workflow: search["workflow"] } : {}),
    ...(typeof search["run"] === "string" ? { run: search["run"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Activity — Synkra Client Portal" },
      { name: "description", content: "Run history and logs for your automations." },
      { property: "og:title", content: "Activity — Synkra Client Portal" },
      { property: "og:description", content: "Run history and logs for your automations." },
    ],
  }),
  component: () => <RouteStub title="Activity" prompt="6" />,
});
