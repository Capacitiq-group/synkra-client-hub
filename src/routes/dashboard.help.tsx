import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Help — Synkra Client Portal" },
      { name: "description", content: "Guides and support for the Synkra client portal." },
      { property: "og:title", content: "Help — Synkra Client Portal" },
      { property: "og:description", content: "Guides and support for the Synkra client portal." },
    ],
  }),
  component: () => <RouteStub title="Help" prompt="8" />,
});
