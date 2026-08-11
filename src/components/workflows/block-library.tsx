import { useState } from "react";
import { BLOCK_DEFINITIONS, type BlockDefinition } from "@/lib/workflow/blocks";

const SECTIONS: BlockDefinition["section"][] = ["TRIGGERS", "ACTIONS", "LOGIC"];

export function BlockLibrary({
  onAdd,
  hasTrigger,
}: {
  onAdd: (definition: BlockDefinition) => void;
  hasTrigger: boolean;
}) {
  const [query, setQuery] = useState("");

  const matches = (definition: BlockDefinition) =>
    !query ||
    definition.label.toLowerCase().includes(query.toLowerCase()) ||
    definition.description.toLowerCase().includes(query.toLowerCase());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
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
                      </span>
                      <span
                        className="mt-1 block"
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                      >
                        {definition.comingSoon
                          ? "Coming soon"
                          : definition.kind === "trigger" && hasTrigger
                            ? "A workflow can only have one trigger"
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
