import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/workflows/")({
  head: () => ({
    meta: [
      { title: "Workflows — Synkra Client Portal" },
      { name: "description", content: "Activate templates and manage your automation workflows." },
      { property: "og:title", content: "Workflows — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Activate templates and manage your automation workflows.",
      },
    ],
  }),
  component: () => <RouteStub title="Workflows" prompt="4" />,
});
