import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import {
  disconnectIntegration,
  integrationConnectUrl,
  testIntegration,
} from "@/lib/workflow/api";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { SlackConnectButton } from "@/components/integrations/slack-connect";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE, integrationsAllowed } from "@/lib/plans";
import {
  INTEGRATIONS,
  INTEGRATION_CATEGORIES,
  findIntegration,
  matchesQuery,
  resolveStatus,
  statusColor,
  type IntegrationCategory,
  type IntegrationDefinition,
} from "@/lib/integrations/catalog";

type IntegrationRecord = {
  id: string;
  status?: string;
  error_message?: string;
  connected_email?: string;
  /** Slack stores the workspace name here; HubSpot the portal name. */
  display_name?: string;
};

export interface DirectorySearch {
  q?: string | undefined;
  category?: string | undefined;
  integration?: string | undefined;
  connected?: string | undefined;
}

function Logo({ item, size = 44 }: { item: IntegrationDefinition; size?: number }) {
  const Icon = item.icon;
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full p-2"
      style={{
        height: size,
        width: size,
        backgroundColor: item.logoBg ?? item.iconBg ?? "var(--bg-primary)",
      }}
    >
      {item.logoUrl ? (
        <img
          src={item.logoUrl}
          alt={`${item.name} logo`}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : Icon ? (
        <Icon size={Math.round(size * 0.48)} style={{ color: item.iconColor }} />
      ) : null}
    </span>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, border: `1px solid ${color}` }}
    >
      {label}
    </span>
  );
}

export function IntegrationDirectory({ search }: { search: DirectorySearch }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usage = usePlanUsage();
  const planAllows = usage.data ? integrationsAllowed(usage.data.tier) : true;

  const query = useQuery({
    queryKey: ["integrations", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return {} as Record<string, IntegrationRecord>;
      const records = await pb
        .collection("integrations")
        .getFullList({ filter: pb.filter("user_id = {:userId}", { userId: user.id }) });
      return Object.fromEntries(records.map((record) => [record["type"], record])) as Record<
        string,
        IntegrationRecord
      >;
    },
  });

  const setSearch = (next: Partial<DirectorySearch>) => {
    void navigate({
      to: "/dashboard/integrations",
      search: (prev: DirectorySearch) => {
        const merged = { ...prev, ...next };
        return Object.fromEntries(
          Object.entries(merged).filter(([, value]) => value !== undefined && value !== ""),
        ) as DirectorySearch;
      },
      replace: true,
    });
  };

  // OAuth callbacks land here with ?connected=<key>.
  const connectedParam = search.connected;
  useEffect(() => {
    if (!connectedParam) return;
    const item = findIntegration(connectedParam);
    toast.success(`${item?.name ?? connectedParam} connected`);
    void queryClient.invalidateQueries({ queryKey: ["integrations", user?.id] });
    void navigate({ to: "/dashboard/integrations", search: {}, replace: true });
  }, [connectedParam, navigate, queryClient, user?.id]);

  const activeCategory = INTEGRATION_CATEGORIES.includes(search.category as IntegrationCategory)
    ? (search.category as IntegrationCategory)
    : undefined;
  const queryText = search.q ?? "";

  const grouped = useMemo(() => {
    const visible = INTEGRATIONS.filter(
      (item) =>
        matchesQuery(item, queryText) && (!activeCategory || item.category === activeCategory),
    );
    return INTEGRATION_CATEGORIES.map((category) => ({
      category,
      items: visible.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [queryText, activeCategory]);

  const totalVisible = grouped.reduce((sum, group) => sum + group.items.length, 0);
  const selected = findIntegration(search.integration);

  if (!user) return null;

  /**
   * Paid-plan gate. The server re-reads the tier and decides; the UI only
   * reflects that decision, so a stale client tier can never open the flow.
   */
  const connect = async (item: IntegrationDefinition) => {
    // Slack has its own popup flow (see SlackConnectButton); this is the
    // redirect-based OAuth path used by HubSpot.
    if (item.endpoint !== "hubspot") return;
    const token = pb.authStore.token;
    if (!token) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    try {
      const decision = (await checkIntegrationConnectFn({ data: { token } })) as unknown as {
        ok: boolean;
        message?: string;
      };
      if (!decision.ok) {
        toast.error(decision.message || INTEGRATIONS_PAID_PLAN_NOTE);
        void navigate({ to: "/dashboard/settings", search: { tab: "billing" } });
        return;
      }
    } catch {
      toast.error("Could not verify your plan. Please try again.");
      return;
    }
    window.location.assign(integrationConnectUrl(item.endpoint, user.id));
  };

  const test = async (item: IntegrationDefinition) => {
    try {
      await testIntegration(item.key, user.id);
      toast.success("Connection is working");
    } catch {
      toast.error("Connection test failed");
    }
  };

  const disconnect = async (item: IntegrationDefinition) => {
    try {
      await disconnectIntegration(item.key, user.id);
      await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
      toast.success(`${item.name} disconnected`);
    } catch {
      toast.error("Could not disconnect integration");
    }
  };

  const actionsFor = (item: IntegrationDefinition) => {
    const record = query.data?.[item.key];
    if (item.availability === "not_yet") {
      return (
        <Button disabled title="This integration is not available yet">
          Not available
        </Button>
      );
    }
    if (item.availability === "built_in") {
      return (
        <span className="text-[13px]" style={{ color: "var(--state-success)" }}>
          No setup needed
        </span>
      );
    }
    if (record?.status === "connected") {
      return (
        <>
          <Button variant="secondary" onClick={() => void test(item)}>
            Test
          </Button>
          <Button variant="secondary" onClick={() => void disconnect(item)}>
            Disconnect
          </Button>
        </>
      );
    }
    if (item.requiresPaidPlan && !planAllows) {
      return (
        <Button
          variant="secondary"
          onClick={() => void navigate({ to: "/dashboard/settings", search: { tab: "billing" } })}
        >
          Upgrade to connect
        </Button>
      );
    }
    if (item.key === "slack") return <SlackConnectButton />;
    return <Button onClick={() => void connect(item)}>Connect</Button>;
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Integrations</h1>
      <p className="mt-2 max-w-2xl text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Everything Synkra can connect to today, grouped by category. Each listing states plainly
        whether it is available now, needs a paid plan, or is not built yet.
      </p>

      {!planAllows && (
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
          style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-card)" }}
        >
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {INTEGRATIONS_PAID_PLAN_NOTE}
          </span>
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: "/dashboard/settings", search: { tab: "billing" } })}
          >
            Upgrade plan
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <Input
            type="search"
            value={queryText}
            aria-label="Search integrations by name"
            placeholder="Search integrations by name"
            className="pl-9"
            onChange={(event) => setSearch({ q: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={!activeCategory}
            onClick={() => setSearch({ category: undefined })}
            className="synkra-focus rounded-full px-3 py-1.5 text-[13px]"
            style={{
              border: "1px solid var(--border-default)",
              backgroundColor: !activeCategory ? "var(--accent-green-subtle)" : "transparent",
              color: !activeCategory ? "var(--accent-green)" : "var(--text-secondary)",
            }}
          >
            All categories
          </button>
          {INTEGRATION_CATEGORIES.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={active}
                onClick={() => setSearch({ category })}
                className="synkra-focus rounded-full px-3 py-1.5 text-[13px]"
                style={{
                  border: "1px solid var(--border-default)",
                  backgroundColor: active ? "var(--accent-green-subtle)" : "transparent",
                  color: active ? "var(--accent-green)" : "var(--text-secondary)",
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {totalVisible === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No integrations match your search.
        </p>
      ) : (
        grouped.map((group) => (
          <section key={group.category} className="mt-10">
            <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
              {group.category}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {group.items.map((item) => {
                const record = query.data?.[item.key];
                const status = resolveStatus(item, planAllows, record?.status);
                return (
                  <article
                    key={item.key}
                    className="flex flex-col gap-4 border p-5"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-default)",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <Logo item={item} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{item.name}</h3>
                          {item.requiresPaidPlan && (
                            <Chip label="Paid plan" color="var(--text-muted)" />
                          )}
                        </div>
                        <p
                          className="mt-1 text-[13px] font-medium"
                          style={{ color: statusColor(status.tone) }}
                        >
                          {status.label}
                        </p>
                        {record?.status === "error" && record.error_message && (
                          <p className="mt-1 text-xs" style={{ color: "var(--state-error)" }}>
                            {record.error_message}
                          </p>
                        )}
                        {record?.status === "connected" && record.display_name && (
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            Workspace: {record.display_name}
                          </p>
                        )}
                        {record?.status === "connected" && record.connected_email && (
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            Connected as: {record.connected_email}
                          </p>
                        )}
                        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.summary}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" onClick={() => setSearch({ integration: item.key })}>
                        Details
                      </Button>
                      {actionsFor(item)}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSearch({ integration: undefined });
        }}
      >
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Logo item={selected} size={36} />
                  {selected.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip label={selected.category} color="var(--text-muted)" />
                  {(() => {
                    const status = resolveStatus(
                      selected,
                      planAllows,
                      query.data?.[selected.key]?.status,
                    );
                    return <Chip label={status.label} color={statusColor(status.tone)} />;
                  })()}
                  {selected.requiresPaidPlan && (
                    <Chip label="Paid plan" color="var(--text-muted)" />
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {selected.description}
                </p>
                {selected.notes && (
                  <ul className="list-disc space-y-1 pl-5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                    {selected.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-2">{actionsFor(selected)}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
      }

        
