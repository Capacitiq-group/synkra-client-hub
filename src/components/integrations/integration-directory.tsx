import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import {
  disconnectIntegration,
  testIntegration,
} from "@/lib/workflow/api";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { SlackConnectButton } from "@/components/integrations/slack-connect";
import { HubspotConnectButton } from "@/components/integrations/hubspot-connect";
import { ZohoConnectButton } from "@/components/integrations/zoho-connect";
import { ZohoAutomationToggles } from "@/components/integrations/zoho-automation-toggles";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE, integrationsAllowed } from "@/lib/plans";
import {
  INTEGRATIONS,
  INTEGRATION_CATEGORIES,
  INTEGRATION_STATUS_FILTERS,
  findIntegration,
  matchesQuery,
  resolveIntegrationState,
  type IntegrationCategory,
  type IntegrationDefinition,
  type IntegrationStateKind,
} from "@/lib/integrations/catalog";

import { useIntegrationsMap, type IntegrationRecord } from "@/hooks/useIntegrations";

export interface DirectorySearch {
  q?: string | undefined;
  category?: string | undefined;
  integration?: string | undefined;
  connected?: string | undefined;
  status?: string | undefined;
}

function Logo({ item, size = 40 }: { item: IntegrationDefinition; size?: number }) {
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

/** One calm status line. Only shown where the CTA does not already say it. */
function StateLine({ kind }: { kind: IntegrationStateKind }) {
  const map: Record<IntegrationStateKind, { label: string; color: string } | null> = {
    connected: { label: "Connected", color: "var(--state-success)" },
    included: { label: "Included on your plan", color: "var(--text-muted)" },
    error: { label: "Connection error", color: "var(--state-error)" },
    locked: null,
    disconnected: null,
    unavailable: null,
  };
  const state = map[kind];
  if (!state) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: state.color }}>
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: state.color }}
      />
      {state.label}
    </span>
  );
}

/** Compact, scalable filter control: label + optional value, popover list. */
function FilterMenu({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value?: string | undefined;
  options: { value: string; label: string }[];
  onSelect: (next: string | undefined) => void;
}) {
  const active = options.find((option) => option.value === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="synkra-focus inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[13px]"
          style={{
            border: `1px solid ${active ? "var(--accent-green)" : "var(--border-default)"}`,
            backgroundColor: active ? "var(--accent-green-subtle)" : "transparent",
            color: active ? "var(--accent-green)" : "var(--text-secondary)",
          }}
        >
          <span className="truncate">{active ? active.label : label}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div role="listbox" aria-label={label}>
          <button
            type="button"
            role="option"
            aria-selected={!active}
            onClick={() => onSelect(undefined)}
            className="synkra-focus flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--bg-primary)]"
            style={{ color: "var(--text-secondary)" }}
          >
            {label}
            {!active && <Check size={14} style={{ color: "var(--accent-green)" }} />}
          </button>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(option.value)}
                className="synkra-focus flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--bg-primary)]"
                style={{ color: selected ? "var(--accent-green)" : "var(--text-primary)" }}
              >
                <span className="truncate">{option.label}</span>
                {selected && <Check size={14} style={{ color: "var(--accent-green)" }} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function IntegrationDirectory({ search }: { search: DirectorySearch }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usage = usePlanUsage();
  const planAllows = usage.data ? integrationsAllowed(usage.data.tier) : true;

  const query = useIntegrationsMap();

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
  const activeStatus = INTEGRATION_STATUS_FILTERS.some((option) => option.value === search.status)
    ? (search.status as IntegrationStateKind)
    : undefined;
  const queryText = search.q ?? "";

  const stateOf = (item: IntegrationDefinition) =>
    resolveIntegrationState(item, planAllows, query.data?.[item.key]?.status);

  const visible = useMemo(() => {
    return INTEGRATIONS.filter((item) => {
      // Built-in capabilities (AI, webhooks, messaging) are not connectable
      // platforms, so the directory only lists real integrations.
      if (item.hiddenFromDirectory) return false;
      if (!matchesQuery(item, queryText)) return false;
      if (activeCategory && item.category !== activeCategory) return false;
      if (activeStatus) {
        const state = resolveIntegrationState(
          item,
          planAllows,
          query.data?.[item.key]?.status,
        );
        // "Connected" also surfaces connections currently in an error state.
        if (activeStatus === "connected" && state !== "connected" && state !== "error") {
          return false;
        }
        if (activeStatus !== "connected" && state !== activeStatus) return false;
      }
      return true;
    });
  }, [queryText, activeCategory, activeStatus, planAllows, query.data]);

  const filtersActive = Boolean(activeCategory || activeStatus || queryText);
  const selected = findIntegration(search.integration);

  if (!user) return null;

  /**
   * Paid-plan gate. The server re-reads the tier and decides; the UI only
   * reflects that decision, so a stale client tier can never open the flow.
   */
  const connect = async (item: IntegrationDefinition) => {
    // Slack, HubSpot, and Zoho all now use their own popup flow (see
    // SlackConnectButton / HubspotConnectButton / ZohoConnectButton
    // above) — this redirect-based path is currently unreachable, kept
    // only as a shape for a future integration that isn't Nango-based.
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
    // Slack, HubSpot, and Zoho all use their own popup button above —
    // this fallback is unreachable today. Left as a clear error rather
    // than removed, so a future integration added without its own
    // popup component fails loudly instead of silently.
    toast.error(`${item.name} doesn't have a connect flow wired up yet.`);
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

  const goToBilling = () =>
    void navigate({ to: "/dashboard/settings", search: { tab: "billing" } });

  /** Single primary action per card. Deeper controls live in the detail view. */
  const primaryAction = (item: IntegrationDefinition) => {
    const state = stateOf(item);
    if (state === "unavailable") {
      return (
        <Button disabled title="This integration is not available yet">
          Not available
        </Button>
      );
    }
    if (state === "included" || state === "connected" || state === "error") {
      return (
        <Button variant="secondary" onClick={() => setSearch({ integration: item.key })}>
          Manage
        </Button>
      );
    }
    if (state === "locked") {
      return (
        <Button variant="secondary" onClick={goToBilling}>
          Upgrade to connect
        </Button>
      );
    }
    if (item.key === "slack") return <SlackConnectButton />;
    if (item.key === "hubspot") return <HubspotConnectButton />;
    if (item.key === "zoho") return <ZohoConnectButton />;
    return <Button onClick={() => void connect(item)}>Connect</Button>;
  };

  /** Full action set, used inside the detail dialog only. */
  const detailActions = (item: IntegrationDefinition) => {
    const state = stateOf(item);
    if (state === "connected" || state === "error") {
      return (
        <>
          <Button variant="secondary" onClick={() => void test(item)}>
            Test connection
          </Button>
          <Button variant="secondary" onClick={() => void disconnect(item)}>
            Disconnect
          </Button>
        </>
      );
    }
    if (state === "included") return null;
    return primaryAction(item);
  };

  const selectedRecord = selected ? query.data?.[selected.key] : undefined;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Integrations</h1>
      <p className="mt-2 max-w-2xl text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Connect the apps you already use with Synkra so your workflows can act across them.
      </p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <Input
            type="search"
            value={queryText}
            aria-label="Search integrations"
            placeholder="Search integrations..."
            className="pl-9"
            onChange={(event) => setSearch({ q: event.target.value })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="All categories"
            value={activeCategory}
            options={INTEGRATION_CATEGORIES.filter((category) =>
              INTEGRATIONS.some((item) => !item.hiddenFromDirectory && item.category === category),
            ).map((category) => ({
              value: category,
              label: category,
            }))}
            onSelect={(next) => setSearch({ category: next })}
          />
          <FilterMenu
            label="Status"
            value={activeStatus}
            options={INTEGRATION_STATUS_FILTERS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            onSelect={(next) => setSearch({ status: next })}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={() => setSearch({ q: undefined, category: undefined, status: undefined })}
              className="synkra-focus inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={13} aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </div>

      {!planAllows && (
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg p-4"
          style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-card)" }}
        >
          <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {INTEGRATIONS_PAID_PLAN_NOTE}
          </span>
          <Button variant="secondary" onClick={goToBilling}>
            Upgrade plan
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-10 text-sm" style={{ color: "var(--text-muted)" }}>
          No integrations match your search.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <article
              key={item.key}
              className="flex flex-col gap-4 border p-5"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Logo item={item} />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold" title={item.name}>
                    {item.name}
                  </h3>
                  <StateLine kind={stateOf(item)} />
                </div>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {item.summary}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {primaryAction(item)}
                <button
                  type="button"
                  onClick={() => setSearch({ integration: item.key })}
                  className="synkra-focus rounded-md px-1 text-[13px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Details
                </button>
              </div>
            </article>
          ))}
        </div>
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
                <DialogTitle className="flex min-w-0 items-center gap-3">
                  <Logo item={selected} size={36} />
                  <span className="truncate">{selected.name}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <StateLine kind={stateOf(selected)} />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {selected.category}
                  </span>
                </div>
                {selectedRecord?.status === "error" && selectedRecord.error_message && (
                  <p className="text-xs" style={{ color: "var(--state-error)" }}>
                    {selectedRecord.error_message}
                  </p>
                )}
                {selectedRecord?.status === "connected" && selectedRecord.display_name && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Workspace: {selectedRecord.display_name}
                  </p>
                )}
                {selectedRecord?.status === "connected" && selectedRecord.connected_email && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Connected as: {selectedRecord.connected_email}
                  </p>
                )}
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {selected.description}
                </p>
                {selected.notes && (
                  <ul
                    className="list-disc space-y-1 pl-5 text-[13px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {selected.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
                {selected.key === "zoho" && selectedRecord?.status === "connected" && (
                  <ZohoAutomationToggles record={selectedRecord} />
                )}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {detailActions(selected)}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
          }

                         
