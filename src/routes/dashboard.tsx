import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { NAV_ITEMS, NavLink, useIsActive } from "@/components/portal/nav-items";
import { ThemeToggle } from "@/components/portal/theme-toggle";
import { SessionWarningModal } from "@/components/portal/session-warning-modal";
import { OnboardingWizard } from "@/components/portal/onboarding-wizard";
import { PWAInstallPrompt } from "@/components/portal/pwa-install-prompt";
import pb from "@/lib/pocketbase";
import { sendNotificationEmail } from "@/lib/notifications";
import { getLastActivity, initSession, isSessionExpired, teardownSession } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): { onboarding?: boolean } =>
    search["onboarding"] === true || search["onboarding"] === "true" ? { onboarding: true } : {},
  component: DashboardLayout,
});

function Wordmark() {
  return (
    <div>
      <div
        className="text-md font-extrabold"
        style={{ color: "var(--accent-green)", letterSpacing: "0.1em", fontSize: 16 }}
      >
        SYNKRA
      </div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        Client Portal
      </div>
    </div>
  );
}

function UserFooter() {
  const user = useAuthStore((s) => s.user);
  const initials = (user?.name || user?.email || "S")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-3 border-t p-4" style={{ borderColor: "var(--border-default)" }}>
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "var(--accent-green-subtle)",
            color: "var(--accent-green)",
          }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{user?.name || user?.email || "Signed out"}</div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{
            backgroundColor: "var(--accent-green-subtle)",
            color: "var(--accent-green)",
            fontSize: 10,
          }}
        >
          {user?.user_type === "paid" ? "PRO" : "BETA"}
        </span>
      </div>
      <ThemeToggle />
    </div>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  const { onboarding } = Route.useSearch();
  const [wizardOpen, setWizardOpen] = useState(false);
  const isReady = useAuthStore((s) => s.isReady);
  const user = useAuthStore((s) => s.user);
  const [warningOpen, setWarningOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = useIsActive();

  useEffect(() => {
    if (isReady && !user) navigate({ to: "/login", replace: true });
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (!isReady) return;
    if (!pb.authStore.isValid || (getLastActivity() > 0 && isSessionExpired())) {
      useAuthStore.getState().logout();
      navigate({ to: "/login", search: { reason: "expired" }, replace: true });
    }
  }, [isReady, navigate]);

  useEffect(() => {
    if (onboarding) setWizardOpen(true);
  }, [onboarding]);

  // Email the user when one of their workflow runs fails.
  useEffect(() => {
    if (!user || !user.notify_on_failure) return;
    const notificationEmail = user.notification_email || user.email;
    void pb.collection("workflow_runs").subscribe("*", (event) => {
      const record = event.record as unknown as Record<string, string>;
      if (event.action !== "update") return;
      if (record["user_id"] !== user.id || record["status"] !== "failed") return;
      void sendNotificationEmail({
        to: notificationEmail,
        subject: "A Synkra workflow has failed",
        body: `Hi,\n\nOne of your automations encountered an error.\n\nWorkflow run: ${record["id"]}\nError: ${record["error_message"] || "Unknown error"}\n\nGo to your Activity page to see the full details and retry the run.\n\nhttps://client.synkra.co.za/dashboard/activity\n\nSynkra`,
      });
    });
    return () => {
      void pb.collection("workflow_runs").unsubscribe("*");
    };
  }, [user]);

  const closeWizard = () => {
    setWizardOpen(false);
    navigate({ to: "/dashboard", search: {}, replace: true });
  };

  useEffect(() => {
    initSession(
      () => setWarningOpen(true),
      () => {
        useAuthStore.getState().logout();
        navigate({ to: "/login", search: { reason: "expired" }, replace: true });
      },
    );
    return () => teardownSession();
  }, [navigate]);

  if (!isReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r md:flex"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-default)" }}
      >
        <div>
          <div className="p-4">
            <Wordmark />
          </div>
          <nav className="mt-2 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} item={item} />
            ))}
          </nav>
        </div>
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header
        className="fixed inset-x-0 top-0 z-30 flex h-[60px] items-center justify-between border-b px-4 md:hidden"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-default)" }}
      >
        <button type="button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
          <Menu size={20} style={{ color: "var(--text-secondary)" }} />
        </button>
        <div
          className="font-extrabold"
          style={{ color: "var(--accent-green)", letterSpacing: "0.1em", fontSize: 16 }}
        >
          SYNKRA
        </div>
        <button type="button" aria-label="Notifications">
          <Bell size={20} style={{ color: "var(--text-secondary)" }} />
        </button>
      </header>

      {/* Mobile full-screen nav overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col md:hidden"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <div className="flex items-center justify-between p-4">
            <Wordmark />
            <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
              <X size={20} style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>
          <nav className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} item={item} onNavigate={() => setMenuOpen(false)} />
            ))}
          </nav>
          <div className="mt-auto">
            <UserFooter />
          </div>
        </div>
      )}

      {/* Content */}
      <main className="pt-[60px] pb-[60px] md:pt-0 md:pb-0 md:pl-60">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex h-[60px] items-stretch border-t md:hidden"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-default)" }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <a
              key={item.to}
              href={item.to}
              onClick={(e) => {
                e.preventDefault();
                navigate({ to: item.to });
              }}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-xs"
              style={{ color: active ? "var(--accent-green)" : "var(--text-muted)" }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <OnboardingWizard open={wizardOpen} onClose={closeWizard} />

      <SessionWarningModal open={warningOpen} onClose={() => setWarningOpen(false)} />
      <PWAInstallPrompt />
    </div>
  );
}
