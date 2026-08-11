import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Play, Save, Upload, Layers, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createBlock, type BlockDefinition } from "@/lib/workflow/blocks";
import { validateWorkflow } from "@/lib/workflow/describe";
import { saveWorkflowDraft, useWorkflow } from "@/hooks/useWorkflows";
import { registerWorkflow } from "@/lib/workflow/api";
import type { WorkflowBlock } from "@/lib/workflow/types";
import { BlockLibrary } from "./block-library";
import { BuilderCanvas } from "./builder-canvas";
import { ConfigPanel } from "./config-panel";
import { TestModal } from "./test-modal";

type MobileTab = "library" | "canvas" | "config";

export function WorkflowBuilder({ workflowId }: { workflowId?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existing } = useWorkflow(workflowId);

  const [name, setName] = useState("Untitled workflow");
  const [blocks, setBlocks] = useState<WorkflowBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(workflowId);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [testing, setTesting] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const dirty = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!existing || loaded.current) return;
    loaded.current = true;
    setName(existing.name);
    setBlocks(existing.blocks ?? []);
    setSelectedId(existing.blocks?.[0]?.id ?? null);
  }, [existing]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const hasTrigger = blocks.some((b) => b.type === "trigger");

  const mutate = (updater: (current: WorkflowBlock[]) => WorkflowBlock[]) => {
    dirty.current = true;
    setBlocks((current) => {
      const next = updater(current);
      return next.map((block, index) => ({ ...block, next: next[index + 1]?.id ?? null }));
    });
  };

  const addBlock = (definition: BlockDefinition, index?: number) => {
    const block = createBlock(definition);
    mutate((current) => {
      const position = index ?? current.length;
      const next = [...current];
      next.splice(Math.min(position, next.length), 0, block);
      return next;
    });
    setSelectedId(block.id);
    setMobileTab("config");
  };

  const save = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!blocks.length) return;
      setSaving(true);
      try {
        const record = await saveWorkflowDraft({
          ...(savedId ? { workflowId: savedId } : {}),
          userId: user.id,
          name,
          blocks,
        });
        setSavedId(record.id);
        setLastSaved(new Date());
        dirty.current = false;
        if (!silent) toast.success("Workflow saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save workflow");
      } finally {
        setSaving(false);
      }
    },
    [blocks, name, savedId, user],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (dirty.current) void save(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [save]);

  const publish = async () => {
    const validation = validateWorkflow(blocks);
    if (!validation.ok) {
      toast.error(validation.message ?? "Workflow is not ready");
      if (validation.blockId) setSelectedId(validation.blockId);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const record = await saveWorkflowDraft({
        ...(savedId ? { workflowId: savedId } : {}),
        userId: user.id,
        name,
        blocks,
        status: "published",
      });
      setSavedId(record.id);
      const trigger = blocks.find((b) => b.type === "trigger");
      await registerWorkflow({
        workflowId: record.id,
        userId: user.id,
        blocks,
        trigger: { type: trigger?.trigger_type ?? "webhook", config: trigger?.config ?? {} },
      });
      dirty.current = false;
      toast.success("Workflow published");
      void navigate({ to: "/dashboard/workflows" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish workflow");
    } finally {
      setSaving(false);
    }
  };

  const panelBorder = "1px solid var(--border-default)";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: "var(--bg-base, #0a0a0a)" }}
    >
      <header
        className="flex items-center gap-3 px-4"
        style={{ height: 56, borderBottom: panelBorder }}
      >
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard/workflows" })}
          aria-label="Back to workflows"
          className="synkra-focus rounded-sm"
        >
          <ArrowLeft size={16} style={{ color: "var(--text-muted)" }} />
        </button>
        <input
          value={name}
          onChange={(e) => {
            dirty.current = true;
            setName(e.target.value);
          }}
          aria-label="Workflow name"
          className="synkra-focus min-w-0 flex-1 rounded-sm bg-transparent"
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
        />
        <span className="hidden sm:inline" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {saving ? "Saving" : lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-ZA")}` : ""}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          className="synkra-focus inline-flex items-center gap-1.5 rounded-md border"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
            fontSize: 13,
            padding: "6px 12px",
          }}
        >
          <Save size={13} aria-hidden="true" />
          Save
        </button>
        <button
          type="button"
          onClick={() => setTesting(true)}
          className="synkra-focus inline-flex items-center gap-1.5 rounded-md border"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
            fontSize: 13,
            padding: "6px 12px",
          }}
        >
          <Play size={13} aria-hidden="true" />
          Test
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          className="synkra-focus inline-flex items-center gap-1.5 rounded-md"
          style={{
            backgroundColor: "var(--accent-green)",
            color: "#04120B",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 12px",
          }}
        >
          <Upload size={13} aria-hidden="true" />
          Publish
        </button>
      </header>

      {/* Desktop three panel layout */}
      <div className="hidden min-h-0 flex-1 md:flex">
        <aside
          className="h-full min-h-0 shrink-0 overflow-hidden"
          style={{ width: 240, borderRight: panelBorder }}
          aria-label="Block library"
        >
          <BlockLibrary onAdd={(definition) => addBlock(definition)} hasTrigger={hasTrigger} />
        </aside>
        <main className="h-full min-h-0 min-w-0 flex-1 overflow-auto">
          <BuilderCanvas
            blocks={blocks}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={(id) => {
              mutate((current) => current.filter((b) => b.id !== id));
              setSelectedId((v) => (v === id ? null : v));
            }}
            onReorder={(from, to) =>
              mutate((current) => {
                const next = [...current];
                const [moved] = next.splice(from, 1);
                if (moved) next.splice(to, 0, moved);
                return next;
              })
            }
            onDropDefinition={(definition, index) => addBlock(definition, index)}
          />
        </main>
        <aside
          className="h-full min-h-0 shrink-0 overflow-hidden"
          style={{ width: 320, borderLeft: panelBorder }}
          aria-label="Block configuration"
        >
          <ConfigPanel
            blocks={blocks}
            block={selectedBlock}
            onChange={(id, config) =>
              mutate((current) => current.map((b) => (b.id === id ? { ...b, config } : b)))
            }
          />
        </aside>
      </div>

      {/* Mobile single panel with tabs */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          {mobileTab === "library" && (
            <BlockLibrary
              onAdd={(definition) => {
                addBlock(definition);
                setMobileTab("canvas");
              }}
              hasTrigger={hasTrigger}
            />
          )}
          {mobileTab === "canvas" && (
            <BuilderCanvas
              blocks={blocks}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMobileTab("config");
              }}
              onRemove={(id) => {
                mutate((current) => current.filter((b) => b.id !== id));
                setSelectedId((v) => (v === id ? null : v));
              }}
              onReorder={(from, to) =>
                mutate((current) => {
                  const next = [...current];
                  const [moved] = next.splice(from, 1);
                  if (moved) next.splice(to, 0, moved);
                  return next;
                })
              }
              onDropDefinition={(definition, index) => addBlock(definition, index)}
            />
          )}
          {mobileTab === "config" && (
            <ConfigPanel
              blocks={blocks}
              block={selectedBlock}
              onChange={(id, config) =>
                mutate((current) => current.map((b) => (b.id === id ? { ...b, config } : b)))
              }
            />
          )}
        </div>
        <nav
          className="grid grid-cols-3"
          style={{ borderTop: panelBorder }}
          aria-label="Builder panels"
        >
          {(
            [
              ["library", "Blocks", Layers],
              ["canvas", "Canvas", Play],
              ["config", "Settings", Settings2],
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className="synkra-focus flex flex-col items-center gap-1 py-2"
              style={{
                fontSize: 12,
                color: mobileTab === tab ? "var(--accent-green)" : "var(--text-muted)",
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {testing && user && (
        <TestModal
          blocks={blocks}
          userId={user.id}
          user={{
            ...(user.email ? { email: user.email } : {}),
            ...(user.name ? { name: user.name } : {}),
          }}
          onClose={() => setTesting(false)}
        />
      )}
    </div>
  );
    }
        
