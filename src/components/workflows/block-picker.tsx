/**
 * Progressive-disclosure block selector.
 *
 * Replaces the always-visible block library with a modal that reveals
 * only what's relevant to the step being added:
 *
 *   1. Pick a platform (Webhook, Slack, HubSpot, Tally, Shopify, ...)
 *   2. Pick one of that platform's events for the requested step kind
 *
 * Typing a search term short-circuits step 1 and matches events directly
 * across every platform ("new deal" -> the HubSpot deal triggers).
 *
 * This file is presentation only: it selects an existing
 * BlockDefinition and hands it to the same onAdd() callback the old
 * BlockLibrary used before it, so block behaviour, config panels and validation
 * are untouched.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BLOCK_DEFINITIONS, type BlockDefinition } from "@/lib/workflow/blocks";
import {
  findIntegration,
  INTEGRATION_CATEGORIES,
  type IntegrationCategory,
} from "@/lib/integrations/catalog";
import { useIntegrationsMap } from "@/hooks/useIntegrations";
import { integrationConnected } from "@/lib/workflow/scopes";
import { HubspotConnectButton } from "@/components/integrations/hubspot-connect";
import { SlackConnectButton } from "@/components/integrations/slack-connect";
import { ZohoConnectButton } from "@/components/integrations/zoho-connect";
import { TallyConnectButton } from "@/components/integrations/tally-connect";
import { GenericConnectButton } from "@/components/integrations/generic-connect";

export type PickerMode = "trigger" | "action" | "logic";

/**
 * Platforms that aren't connectable integrations but still group blocks
 * sensibly. Anything with `requiresIntegration` uses that key instead and
 * reads its name/category/logo straight from the integration catalog.
 */
const PSEUDO_PLATFORMS: Record<
  string,
  { name: string; category: IntegrationCategory; summary: string }
> = {
  core: {
    name: "Synkra",
    category: "Automation",
    summary: "Built-in steps — schedules, waiting, saving and finding information.",
  },
  logic: {
    name: "Logic",
    category: "Automation",
    summary: "Conditions, filters, sorting and loops.",
  },
};

/** Which platform a block belongs to, for grouping in the picker. */
export function platformForBlock(definition: BlockDefinition): string {
  if (definition.requiresIntegration) return definition.requiresIntegration;
  if (definition.section === "LOGIC") return "logic";

  const key = definition.key;
  if (key === "webhook" || key === "custom_api_call") return "webhook";
  if (key === "send_email" || key === "email_received") return "email";
  if (key === "send_whatsapp") return "whatsapp";
  if (key === "send_sms") return "sms";
  if (definition.usesCredits || key.startsWith("ai_") || key.endsWith("_ai")) return "ai";
  return "core";
}

function platformMeta(key: string) {
  const integration = findIntegration(key);
  if (integration) {
    return {
      key,
      name: integration.name,
      category: integration.category,
      summary: integration.summary,
      logoUrl: integration.logoUrl,
      logoBg: integration.logoBg,
      icon: integration.icon,
      iconColor: integration.iconColor,
      connectable: !integration.includedOnEveryPlan,
    };
  }
  const pseudo = PSEUDO_PLATFORMS[key] ?? {
    name: key,
    category: "Automation" as IntegrationCategory,
    summary: "",
  };
  return {
    key,
    name: pseudo.name,
    category: pseudo.category,
    summary: pseudo.summary,
    logoUrl: undefined as string | undefined,
    logoBg: undefined as string | undefined,
    icon: undefined,
    iconColor: undefined as string | undefined,
    connectable: false,
  };
}

function ConnectControl({ platformKey }: { platformKey: string }) {
  if (platformKey === "hubspot") return <HubspotConnectButton label="Connect HubSpot" />;
  if (platformKey === "slack") return <SlackConnectButton label="Connect Slack" />;
  if (platformKey === "zoho") return <ZohoConnectButton label="Connect Zoho Books" />;
  if (platformKey === "tally") return <TallyConnectButton />;

  const integration = findIntegration(platformKey);
  if (!integration?.endpoint) return null;
  return <GenericConnectButton providerKey={platformKey} label={`Connect ${integration.name}`} />;
}

export function BlockPicker({
  mode,
  hasTrigger,
  onAdd,
  onClose,
}: {
  mode: PickerMode;
  hasTrigger: boolean;
  onAdd: (definition: BlockDefinition) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IntegrationCategory | "all">("all");
  const [platform, setPlatform] = useState<string | null>(mode === "logic" ? "logic" : null);
  const { data: integrations = {} } = useIntegrationsMap();

  const section = mode === "trigger" ? "TRIGGERS" : mode === "logic" ? "LOGIC" : "ACTIONS";

  const pool = useMemo(
    () => BLOCK_DEFINITIONS.filter((d) => d.section === section),
    [section],
  );

  const platforms = useMemo(() => {
    const keys = Array.from(new Set(pool.map(platformForBlock)));
    return keys
      .map((key) => ({ ...platformMeta(key), count: pool.filter((d) => platformForBlock(d) === key).length }))
      .filter((p) => category === "all" || p.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pool, category]);

  const availableCategories = useMemo(() => {
    const used = new Set(pool.map((d) => platformMeta(platformForBlock(d)).category));
    return INTEGRATION_CATEGORIES.filter((c) => used.has(c));
  }, [pool]);

  const needle = query.trim().toLowerCase();

  /** Free-text search matches events directly, across every platform. */
  const searchResults = useMemo(() => {
    if (!needle) return [];
    return pool.filter((d) => {
      const meta = platformMeta(platformForBlock(d));
      if (category !== "all" && meta.category !== category) return false;
      return [d.label, d.description, d.configHint ?? "", meta.name, meta.key]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [pool, needle, category]);

  const platformBlocks = useMemo(
    () => (platform ? pool.filter((d) => platformForBlock(d) === platform) : []),
    [pool, platform],
  );

  const title =
    mode === "trigger" ? "Select a trigger" : mode === "logic" ? "Add logic" : "Add an action";

  const activeMeta = platform ? platformMeta(platform) : null;
  const platformConnected =
    !activeMeta?.connectable || integrationConnected(platform ?? undefined, integrations);

  const renderBlockRow = (definition: BlockDefinition) => {
    const meta = platformMeta(platformForBlock(definition));
    const notConnected =
      meta.connectable && !integrationConnected(definition.requiresIntegration, integrations);
    const disabled = Boolean(definition.comingSoon) || (definition.kind === "trigger" && hasTrigger);

    return (
      <button
        key={definition.key}
        type="button"
        disabled={disabled}
        onClick={() => {
          onAdd(definition);
          onClose();
        }}
        className="synkra-focus w-full rounded-md text-left transition-colors"
        style={{
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-card)",
          padding: 12,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span className="flex items-center gap-2">
          <definition.icon size={15} style={{ color: definition.color }} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            {definition.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{meta.name}</span>
          {notConnected && !disabled && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--state-warning)",
                border: "1px solid var(--state-warning)",
                borderRadius: 999,
                padding: "1px 6px",
                marginLeft: "auto",
              }}
            >
              Not connected
            </span>
          )}
        </span>
        <span className="mt-1 block" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {definition.comingSoon
            ? "Coming soon"
            : definition.kind === "trigger" && hasTrigger
              ? "A workflow can only have one trigger"
              : definition.description}
        </span>
      </button>
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[80vh] w-full max-w-[720px] flex-col gap-0 p-0">
        <DialogHeader className="border-b p-4" style={{ borderColor: "var(--border-default)" }}>
          <DialogTitle className="flex items-center gap-2">
            {platform && mode !== "logic" && !needle && (
              <button
                type="button"
                onClick={() => setPlatform(null)}
                aria-label="Back to platforms"
                className="synkra-focus rounded-sm"
              >
                <ArrowLeft size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            )}
            {platform && !needle && mode !== "logic" ? `${activeMeta?.name} — ${title.toLowerCase()}` : title}
          </DialogTitle>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {platform || needle || mode === "logic"
              ? "Choose the step you want to add."
              : "Start by choosing the app or service this step uses."}
          </p>
        </DialogHeader>

        <div
          className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="relative flex-1">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "trigger"
                  ? "Search apps or events, e.g. new deal"
                  : "Search apps or steps"
              }
              aria-label="Search"
              className="synkra-focus w-full"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: 13,
                padding: "8px 10px 8px 30px",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="synkra-focus absolute right-2 top-1/2 -translate-y-1/2 rounded-sm"
              >
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            )}
          </div>

          {mode !== "logic" && (
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as IntegrationCategory | "all");
                setPlatform(null);
              }}
              aria-label="Filter by category"
              className="synkra-focus"
              style={{
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: 13,
                padding: "8px 10px",
              }}
            >
              <option value="all">All categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {needle ? (
            searchResults.length ? (
              <div className="flex flex-col gap-2">{searchResults.map(renderBlockRow)}</div>
            ) : (
              <p className="p-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                Nothing matches “{query}”. Try another word, or clear the search to browse by app.
              </p>
            )
          ) : platform ? (
            <div className="flex flex-col gap-3">
              {!platformConnected && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md p-3"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--state-warning)",
                  }}
                >
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {activeMeta?.name} isn’t connected yet. You can still add the step — connect
                    before publishing so it can run.
                  </p>
                  {platform && <ConnectControl platformKey={platform} />}
                </div>
              )}
              <div className="flex flex-col gap-2">{platformBlocks.map(renderBlockRow)}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {platforms.map((p) => {
                const connected = !p.connectable || integrationConnected(p.key, integrations);
                const Icon = p.icon;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    className="synkra-focus rounded-md text-left"
                    style={{
                      border: "1px solid var(--border-default)",
                      backgroundColor: "var(--bg-card)",
                      padding: 12,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {p.logoUrl ? (
                        <img
                          src={p.logoUrl}
                          alt=""
                          aria-hidden="true"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            objectFit: "contain",
                            backgroundColor: p.logoBg ?? "transparent",
                          }}
                        />
                      ) : Icon ? (
                        <Icon size={16} style={{ color: p.iconColor }} aria-hidden="true" />
                      ) : null}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          marginLeft: "auto",
                          borderRadius: 999,
                          padding: "1px 6px",
                          color: connected ? "var(--accent-green)" : "var(--text-muted)",
                          border: `1px solid ${connected ? "var(--accent-green)" : "var(--border-default)"}`,
                        }}
                      >
                        {connected ? "Ready" : "Not connected"}
                      </span>
                    </span>
                    <span
                      className="mt-1 block"
                      style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                      {p.count} {p.count === 1 ? "option" : "options"}
                      {p.summary ? ` · ${p.summary}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
