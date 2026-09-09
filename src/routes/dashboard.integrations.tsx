import { createFileRoute } from "@tanstack/react-router";
import { ForwardingAddressCard } from "@/components/email/forwarding-address-card";
import {
  IntegrationDirectory,
  type DirectorySearch,
} from "@/components/integrations/integration-directory";

export const Route = createFileRoute("/dashboard/integrations")({
  validateSearch: (search: Record<string, unknown>): DirectorySearch => ({
    ...(search["q"] ? { q: String(search["q"]) } : {}),
    ...(search["category"] ? { category: String(search["category"]) } : {}),
    ...(search["integration"] ? { integration: String(search["integration"]) } : {}),
    ...(search["connected"] ? { connected: String(search["connected"]) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Integrations — Synkra Client Portal" },
      {
        name: "description",
        content:
          "Browse the Synkra integration directory by category, search by name, and see exactly which platforms are available now.",
      },
      { property: "og:title", content: "Integrations — Synkra Client Portal" },
      {
        property: "og:description",
        content:
          "Browse the Synkra integration directory by category, search by name, and see exactly which platforms are available now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const search = Route.useSearch();
  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 md:px-10">
        <div
          className="rounded-lg p-4"
          style={{
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          {/* Email needs no connection — the forwarding address already exists. */}
          <ForwardingAddressCard title="Email forwarding address" />
        </div>
      </div>
      <IntegrationDirectory search={search} />
    </>
  );
}
