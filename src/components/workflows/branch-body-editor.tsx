/**
 * Editor for one path of an `if_else` block (its "Yes" steps or its "No"
 * steps). Exactly one path runs at execution time; the other path's
 * steps are recorded as skipped by run_blocks in workflow_engine.py.
 *
 * Deliberately mirrors LoopBodyEditor: same modal, same BuilderCanvas /
 * BlockPicker / ConfigPanel reuse, no bespoke nested-canvas rendering.
 * Unlike a loop, a branch shares the outer workflow's working data, so
 * anything a step here stores is usable after the decision.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BlockPicker, type PickerMode } from "./block-picker";
import { BuilderCanvas } from "./builder-canvas";
import { ConfigPanel } from "./config-panel";
import { createBlock, type BlockDefinition } from "@/lib/workflow/blocks";
import type { WorkflowBlock } from "@/lib/workflow/types";

export function BranchBodyEditor({
  pathLabel,
  blocks: initialBlocks,
  onSave,
  onClose,
}: {
  pathLabel: string;
  blocks: WorkflowBlock[];
  onSave: (blocks: WorkflowBlock[]) => void;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<WorkflowBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [picker, setPicker] = useState<PickerMode | null>(null);

  const addBlock = (definition: BlockDefinition, index?: number) => {
    const block = createBlock(definition);
    setBlocks((current) => {
      const position = index ?? current.length;
      const next = [...current];
      next.splice(Math.min(position, next.length), 0, block);
      return next;
    });
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((b) => b.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const reorderBlocks = (from: number, to: number) => {
    setBlocks((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  };

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] w-full max-w-[1100px] flex-col p-0">
        <DialogHeader className="border-b p-4" style={{ borderColor: "var(--border-default)" }}>
          <DialogTitle>Steps for “{pathLabel}”</DialogTitle>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            These run only when the decision goes down the “{pathLabel}” path. The other path&apos;s
            steps are skipped.
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-auto p-3">
            {blocks.length === 0 && (
              <p className="pb-2 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                Add a step — it will run only on the “{pathLabel}” path.
              </p>
            )}
            <div className="flex justify-center gap-2 pb-3">
              <button
                type="button"
                onClick={() => setPicker("action")}
                className="synkra-focus rounded-md px-3 py-2 text-[13px] font-medium"
                style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}
              >
                + Add Action
              </button>
              <button
                type="button"
                onClick={() => setPicker("logic")}
                className="synkra-focus rounded-md px-3 py-2 text-[13px] font-medium"
                style={{ border: "1px dashed var(--border-strong)", color: "var(--text-secondary)" }}
              >
                + Add Logic
              </button>
            </div>
            {blocks.length > 0 && (
              <BuilderCanvas
                blocks={blocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={removeBlock}
                onReorder={reorderBlocks}
                onDropDefinition={(definition, index) => addBlock(definition, index)}
              />
            )}
          </div>
          <div className="min-h-0 overflow-auto border-l" style={{ borderColor: "var(--border-default)" }}>
            <ConfigPanel
              blocks={blocks}
              block={selectedBlock}
              onChange={(id, config) =>
                setBlocks((current) => current.map((b) => (b.id === id ? { ...b, config } : b)))
              }
            />
          </div>
        </div>

        {picker && (
          <BlockPicker
            mode={picker}
            hasTrigger
            onAdd={(definition) => addBlock(definition)}
            onClose={() => setPicker(null)}
          />
        )}



        <div
          className="flex items-center justify-end gap-2 border-t p-3"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="synkra-focus h-9 rounded-md px-4 text-[13px] font-medium"
            style={{ border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(blocks)}
            className="synkra-focus h-9 rounded-md px-4 text-[13px] font-semibold"
            style={{ backgroundColor: "var(--accent-green)", color: "var(--bg-base)" }}
          >
            Save steps ({blocks.length})
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
