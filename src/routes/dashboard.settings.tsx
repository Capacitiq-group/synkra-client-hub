import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { BusinessSettings } from "@/components/settings/business-settings";
import { ReviewDestinationsSettings } from "@/components/settings/review-destinations-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { UsageSettings } from "@/components/settings/usage-settings";
import { BillingSettings } from "@/components/settings/billing-settings";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";

type SettingsTab =
  | "profile"
  | "business"
  | "workspace"
  | "usage"
  | "billing"
  | "notifications";

/**
 * Transient value only: ?tab=integrations is accepted purely so beforeLoad can
 * forward it to /dashboard/integrations. It is never rendered as a tab.
 */
type SettingsSearch = { tab: SettingsTab | "integrations"; connected?: string };

export const Route = createFileRoute("/dashboard/settings")({
  /**
   * Integrations moved out of Settings into its own left-sidebar page.
   * The legacy ?tab=integrations link (and the HubSpot OAuth callback that
   * returns to it with ?connected=<key>) is forwarded so the post-connect
   * toast and cache invalidation still fire on the new page.
   */
  beforeLoad: ({ search }: { search: SettingsSearch }) => {
    if (search.tab === "integrations") {
      throw redirect({
        to: "/dashboard/integrations",
        search: search.connected ? { connected: search.connected } : {},
        replace: true,
      });
    }
  },
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    tab: [
      "profile",
      "business",
      "workspace",
      "usage",
      "billing",
      "notifications",
      "integrations",
    ].includes(
      String(search["tab"]),
    )
      ? (search["tab"] as SettingsSearch["tab"])
      : "profile",
    ...(search["connected"] ? { connected: String(search["connected"]) } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Settings — Synkra Client Portal" },
      { name: "description", content: "Manage your business profile, theme and notifications." },
      { property: "og:title", content: "Settings — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Manage your business profile, theme and notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "business", label: "Business" },
    { key: "workspace", label: "Workspace" },
    { key: "usage", label: "Usage" },
    { key: "billing", label: "Billing" },
    { key: "notifications", label: "Notifications" },
  ];
  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Settings</h1>
      <p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Manage your account, business details, connected tools, and notification preferences.
      </p>
      <nav
        className="mt-8 flex h-11 overflow-x-auto border-b"
        style={{ borderColor: "var(--border-default)" }}
        aria-label="Settings sections"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className="h-11 shrink-0 px-4 text-sm"
            style={{
              color: tab === item.key ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: tab === item.key ? 600 : 400,
              borderBottom:
                tab === item.key ? "2px solid var(--accent-green)" : "2px solid transparent",
            }}
            onClick={() => navigate({ to: "/dashboard/settings", search: { tab: item.key } })}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-8">
        {tab === "profile" && <ProfileSettings />}
        {tab === "business" && (
          <div className="flex flex-col gap-8">
            <BusinessSettings />
            <ReviewDestinationsSettings />
          </div>
        )}
        {tab === "workspace" && <WorkspaceSettings />}
        {tab === "usage" && <UsageSettings />}
        {tab === "billing" && <BillingSettings />}
        {tab === "notifications" && <NotificationsSettings />}
      </div>
    </div>
  );
}
