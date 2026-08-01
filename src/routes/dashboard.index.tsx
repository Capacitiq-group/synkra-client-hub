import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Synkra Client Portal" },
      { name: "description", content: "Overview of your Synkra automation workflows." },
      { property: "og:title", content: "Dashboard — Synkra Client Portal" },
      { property: "og:description", content: "Overview of your Synkra automation workflows." },
    ],
  }),
  component: () => <RouteStub title="Dashboard" prompt="3" />,
});
