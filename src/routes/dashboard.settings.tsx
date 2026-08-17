import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { BusinessSettings } from "@/components/settings/business-settings";
import { IntegrationsSettings } from "@/components/settings/integrations-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { UsageSettings } from "@/components/settings/usage-settings";

type SettingsTab = "profile" | "business" | "usage" | "integrations" | "notifications";

export const Route = createFileRoute("/dashboard/settings")({
  validateSearch: (search: Record<string, unknown>): { tab: SettingsTab; connected?: string } => ({
    tab: ["profile", "business", "usage", "integrations", "notifications"].includes(
      String(search["tab"]),
    )
      ? (search["tab"] as SettingsTab)
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
    { key: "usage", label: "Usage" },
    { key: "integrations", label: "Integrations" },
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
        {tab === "business" && <BusinessSettings />}
        {tab === "usage" && <UsageSettings />}
        {tab === "integrations" && <IntegrationsSettings />}
        {tab === "notifications" && <NotificationsSettings />}
      </div>
    </div>
  );
}
