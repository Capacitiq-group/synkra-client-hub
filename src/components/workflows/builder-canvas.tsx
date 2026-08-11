import { useState } from "react";
import { ArrowDown, GripVertical, Trash2, AlertTriangle } from "lucide-react";
import {
  BLOCK_DEFINITIONS,
  definitionFor,
  kindColor,
  type BlockDefinition,
} from "@/lib/workflow/blocks";
import { isConfigured, summariseConfig } from "@/lib/workflow/describe";
import type { WorkflowBlock } from "@/lib/workflow/types";

export function BuilderCanvas({
  blocks,
  selectedId,
  onSelect,
  onRemove,
  onReorder,
  onDropDefinition,
}: {
  blocks: WorkflowBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDropDefinition: (definition: BlockDefinition, index: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDrop = (index: number) => (event: React.DragEvent) => {
    event.preventDefault();
    setOverIndex(null);
    const key = event.dataTransfer.getData("application/synkra-block");
    if (key) {
      const definition = BLOCK_DEFINITIONS.find((d) => d.key === key);
      if (definition) onDropDefinition(definition, index);
      return;
    }
    if (dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, dragIndex < index ? index - 1 : index);
    }
    setDragIndex(null);
  };

  const dropZone = (index: number) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOverIndex(index);
      }}
      onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
      onDrop={handleDrop(index)}
      style={{
        height: overIndex === index ? 40 : 20,
        borderRadius: 8,
        border: overIndex === index ? "1px dashed var(--accent-green)" : "1px dashed transparent",
        backgroundColor: overIndex === index ? "var(--accent-green-subtle)" : "transparent",
        transition: "height 120ms ease",
      }}
      aria-hidden="true"
    />
  );

  return (
    <div className="mx-auto w-full max-w-[560px] overflow-x-hidden px-3 py-6 sm:px-4">
      {blocks.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(0);
          }}
          onDrop={handleDrop(0)}
          className="text-center"
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            padding: "48px 24px",
            backgroundColor: overIndex === 0 ? "var(--accent-green-subtle)" : "transparent",
          }}
        >
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            Add a trigger to start. Tap a block on mobile or drag one across on desktop.
          </p>
        </div>
      ) : (
        <>
          {dropZone(0)}
          {blocks.map((block, index) => {
            const definition = definitionFor(block);
            const Icon = definition?.icon;
            const color = kindColor(block.type);
            const selected = selectedId === block.id;
            const summary = summariseConfig(block);
            const configured = isConfigured(block);

            return (
              <div key={block.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => setDragIndex(null)}
                  onClick={() => onSelect(block.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(block.id);
                    }
                  }}
                  className="synkra-focus w-full text-left"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: `1px solid ${selected ? "var(--accent-green)" : "var(--border-default)"}`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: "var(--radius-lg)",
                    padding: 14,
                    opacity: dragIndex === index ? 0.5 : 1,
                    cursor: "pointer",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical
                      size={14}
                      style={{ color: "var(--text-muted)", cursor: "grab" }}
                      aria-hidden="true"
                    />
                    {Icon && <Icon size={16} style={{ color }} aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate"
                        style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                      >
                        {block.label}
                      </p>
                      {summary && (
                        <p
                          className="truncate"
                          style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}
                        >
                          {summary}
                        </p>
                      )}
                    </div>
                    {!configured && (
                      <AlertTriangle
                        size={14}
                        style={{ color: "var(--state-warning)" }}
                        aria-label="Needs configuration"
                      />
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${block.label}`}
                      className="synkra-focus rounded-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(block.id);
                      }}
                    >
                      <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                </div>

                {index < blocks.length - 1 && (
                  <div className="flex justify-center py-1" aria-hidden="true">
                    <ArrowDown size={14} style={{ color: "var(--border-strong)" }} />
                  </div>
                )}
                {dropZone(index + 1)}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
