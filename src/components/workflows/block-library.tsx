import { useMemo, useState } from "react";
import { BLOCK_DEFINITIONS, type BlockDefinition } from "@/lib/workflow/blocks";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { useIntegrationsMap } from "@/hooks/useIntegrations";
import { integrationConnected } from "@/lib/workflow/scopes";

const SECTIONS: BlockDefinition["section"][] = ["TRIGGERS", "ACTIONS", "LOGIC"];

/** "Everyone" catches every block with no requiresIntegration (email, AI,
 * webhooks, logic, ...) - these aren't gated to one platform, so they don't
 * belong bucketed under any single integration's chip. */
const EVERYONE = "__everyone__";

/**
 * Filter chips are derived from BLOCK_DEFINITIONS + the integration
 * catalog, not hand-maintained. Every block already declares
 * requiresIntegration (or doesn't); every integration already has a
 * name and icon in catalog.ts. A new integration or a new block for an
 * existing one shows up here automatically - nobody has to remember to
 * add a category, which is exactly the maintenance trap that produces
 * a long, unfiltered list in the first place as things grow.
 */
function useFilterChips() {
  return useMemo(() => {
    const present = new Set(BLOCK_DEFINITIONS.map((d) => d.requiresIntegration ?? EVERYONE));
    const chips: Array<{ key: string; label: string; icon: (typeof INTEGRATIONS)[number]["icon"] | null }> = [];
    if (present.has(EVERYONE)) {
      chips.push({ key: EVERYONE, label: "Everyone", icon: null });
    }
    for (const integration of INTEGRATIONS) {
      if (present.has(integration.key)) {
        chips.push({ key: integration.key, label: integration.name, icon: integration.icon });
      }
    }
    return chips;
  }, []);
}

export function BlockLibrary({
  onAdd,
  hasTrigger,
}: {
  onAdd: (definition: BlockDefinition) => void;
  hasTrigger: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const { data: integrations = {} } = useIntegrationsMap();
  const chips = useFilterChips();

  const matches = (definition: BlockDefinition) => {
    if (activeChip && (definition.requiresIntegration ?? EVERYONE) !== activeChip) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return definition.label.toLowerCase().includes(q) || definition.description.toLowerCase().includes(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="synkra-focus w-full"
          style={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "8px 10px",
          }}
        />
        {chips.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter blocks by platform">
            <button
              type="button"
              onClick={() => setActiveChip(null)}
              className="synkra-focus rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "3px 10px",
                border: `1px solid ${activeChip === null ? "var(--accent-green)" : "var(--border-default)"}`,
                color: activeChip === null ? "var(--accent-green)" : "var(--text-muted)",
                backgroundColor: activeChip === null ? "var(--bg-elevated)" : "transparent",
              }}
            >
              All
            </button>
            {chips.map((chip) => {
              const active = activeChip === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveChip(active ? null : chip.key)}
                  className="synkra-focus flex items-center gap-1 rounded-full"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "3px 10px",
                    border: `1px solid ${active ? "var(--accent-green)" : "var(--border-default)"}`,
                    color: active ? "var(--accent-green)" : "var(--text-muted)",
                    backgroundColor: active ? "var(--bg-elevated)" : "transparent",
                  }}
                >
                  {chip.icon && <chip.icon size={11} aria-hidden="true" />}
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-4">
        {SECTIONS.map((section) => {
          const items = BLOCK_DEFINITIONS.filter((d) => d.section === section && matches(d));
          if (!items.length) return null;
          return (
            <div key={section} className="mb-5">
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                {section}
              </p>
              <div className="flex flex-col gap-2">
                {items.map((definition) => {
                  const notConnected = !integrationConnected(definition.requiresIntegration, integrations);
                  const disabled =
                    definition.comingSoon || (definition.kind === "trigger" && hasTrigger);
                  return (
                    <button
                      key={definition.key}
                      type="button"
                      draggable={!disabled}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/synkra-block", definition.key);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      disabled={disabled}
                      onClick={() => onAdd(definition)}
                      className="synkra-focus w-full rounded-md text-left transition-colors"
                      style={{
                        border: "1px solid var(--border-default)",
                        backgroundColor: "var(--bg-card)",
                        padding: 10,
                        opacity: disabled ? 0.5 : 1,
                        cursor: disabled ? "not-allowed" : "grab",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <definition.icon
                          size={14}
                          style={{ color: definition.color }}
                          aria-hidden="true"
                        />
                        <span
                          style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
                        >
                          {definition.label}
                        </span>
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
                      <span
                        className="mt-1 block"
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                      >
                        {definition.comingSoon
                          ? "Coming soon"
                          : definition.kind === "trigger" && hasTrigger
                            ? "A workflow can only have one trigger"
                            : notConnected
                              ? `You can add this now — connect ${definition.requiresIntegration} before publishing.`
                              : definition.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
