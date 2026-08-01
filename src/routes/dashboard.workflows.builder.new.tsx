import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/workflows/builder/new")({
  head: () => ({
    meta: [
      { title: "New Workflow — Synkra Client Portal" },
      { name: "description", content: "Build a new automation workflow from scratch." },
      { property: "og:title", content: "New Workflow — Synkra Client Portal" },
      { property: "og:description", content: "Build a new automation workflow from scratch." },
    ],
  }),
  component: () => <RouteStub title="Workflow Builder — New" prompt="5" />,
});
