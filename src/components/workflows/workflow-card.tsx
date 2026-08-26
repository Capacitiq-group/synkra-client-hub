import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Clock, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/primitives";
import { flowSteps } from "@/lib/workflow/template-summary";
import { relativeTime } from "@/lib/utils/time";
import type { PortalWorkflow } from "@/hooks/useWorkflows";

/**
 * One of the user's own automations. Scannable by design: name, what it does,
 * the app chain, status and a single primary action. Everything else lives in
 * the overflow menu.
 */
export function WorkflowCard({
  workflow,
  templateName,
  onToggleStatus,
  onDuplicate,
  onRename,
  onDelete,
  busy,
}: {
  workflow: PortalWorkflow;
  templateName?: string | undefined;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
  busy?: boolean | undefined;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const isPublished = workflow.status === "published";
  const { steps, extra } = flowSteps(workflow.blocks);

  const openBuilder = () =>
    navigate({
      to: "/dashboard/workflows/builder/$workflowId",
      params: { workflowId: workflow.id },
    });

  const menuItems: { label: string; action: () => void; danger?: boolean }[] = [
    { label: isPublished ? "Pause workflow" : "Resume workflow", action: onToggleStatus },
    {
      label: "View run history",
      action: () => navigate({ to: "/dashboard/activity", search: { workflow: workflow.id } }),
    },
    { label: "Duplicate workflow", action: onDuplicate },
    { label: "Rename workflow", action: onRename },
    { label: "Delete workflow", action: onDelete, danger: true },
  ];

  return (
    <article
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid",
        borderColor:
          workflow.status === "error"
            ? "color-mix(in srgb, var(--state-error) 40%, transparent)"
            : "var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="min-w-0 break-words"
          style={{ fontSize: 16, fontWeight: 650, color: "var(--text-primary)" }}
        >
          {workflow.name}
        </h3>
        <StatusBadge status={workflow.status} />
      </div>

      {workflow.description && (
        <p
          className="synkra-clamp-2"
          style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}
        >
          {workflow.description}
        </p>
      )}

      {steps.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Workflow steps">
          {steps.map((step, index) => (
            <span key={`${step}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={12} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
              )}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-full)",
                  padding: "3px 9px",
                  whiteSpace: "nowrap",
                }}
              >
                {step}
              </span>
            </span>
          ))}
          {extra > 0 && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>+{extra}</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Clock size={12} aria-hidden="true" />
          {workflow.last_run_at
            ? `Last run ${relativeTime(new Date(workflow.last_run_at))}`
            : "Never run yet"}
          {templateName ? ` · from ${templateName}` : ""}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openBuilder}
            className="synkra-focus rounded-md font-semibold"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "#0A0A0A",
              fontSize: 13,
              padding: "7px 16px",
            }}
          >
            Open
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="synkra-focus rounded-md border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                padding: "7px 9px",
              }}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-20 mt-1 w-48 overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      item.action();
                    }}
                    className="block w-full px-3 py-2.5 text-left disabled:opacity-60"
                    style={{
                      fontSize: 13,
                      color: item.danger ? "var(--state-error)" : "var(--text-secondary)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
