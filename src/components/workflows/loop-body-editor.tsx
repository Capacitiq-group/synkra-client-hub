/**
 * Editor for a `for_each` block's nested body. The steps you build here
 * run once per item in the loop, completely separate from the outer
 * workflow's own step list.
 *
 * Deliberately reuses BuilderCanvas, BlockLibrary, and ConfigPanel
 * exactly as they are — no bespoke nested-canvas rendering. This is
 * the pragmatic version of loop-body editing (a self-contained modal)
 * rather than inline nesting on the main canvas, which would need a
 * genuinely different canvas data model and drag-and-drop story. A
 * loop containing another loop works the same way: this modal's own
 * for_each block opens another instance of this same modal on top.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BlockLibrary } from "./block-library";
import { BuilderCanvas } from "./builder-canvas";
import { ConfigPanel } from "./config-panel";
import { createBlock, type BlockDefinition } from "@/lib/workflow/blocks";
import type { WorkflowBlock } from "@/lib/workflow/types";

export function LoopBodyEditor({
  blocks: initialBlocks,
  onSave,
  onClose,
}: {
  blocks: WorkflowBlock[];
  onSave: (blocks: WorkflowBlock[]) => void;
  onClose: () => void;
}) {
  const [blocks, setBlocks] = useState<WorkflowBlock[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(initialBlocks[0]?.id ?? null);

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
          <DialogTitle>Steps for each item</DialogTitle>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            These run once per item in the loop, independently of the rest of the workflow.
          </p>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr_320px]">
          <div className="min-h-0 border-r" style={{ borderColor: "var(--border-default)" }}>
            <BlockLibrary onAdd={(definition) => addBlock(definition)} hasTrigger />
          </div>
          <div className="min-h-0 overflow-auto p-3">
            {blocks.length === 0 ? (
              <p className="p-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                Add a step from the left — it will run once for every item in this loop.
              </p>
            ) : (
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
