import { createFileRoute } from "@tanstack/react-router";
import { RouteStub } from "@/components/portal/route-stub";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Synkra Client Portal" },
      { name: "description", content: "Manage your business profile, theme and notifications." },
      { property: "og:title", content: "Settings — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Manage your business profile, theme and notifications.",
      },
    ],
  }),
  component: () => <RouteStub title="Settings" prompt="7" />,
});
