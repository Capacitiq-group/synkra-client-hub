import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle, Clock, List, MoreHorizontal, Pause, Pencil, Play, Zap } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/primitives";
import { OwnershipBadge } from "@/components/workflows/ownership-badge";
import { relativeTime } from "@/lib/utils/time";
import type { PortalWorkflow } from "@/hooks/useWorkflows";

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="synkra-focus inline-flex min-h-[38px] items-center gap-1.5 rounded-md border transition-colors disabled:opacity-60"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "transparent",
        color: "var(--text-secondary)",
        fontSize: 13,
        padding: "6px 12px",
      }}
    >
      {children}
    </button>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderRadius: "var(--radius-full)",
        padding: "4px 10px",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

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
        padding: 16,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OwnershipBadge kind="user" />
        <StatusBadge status={workflow.status} />
      </div>

      <h3
        className="mt-2 min-w-0 break-words"
        style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}
      >
        {workflow.name}
      </h3>

      {templateName && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          Created by you from the Synkra template “{templateName}”
        </div>
      )}

      <div
        className="mt-2 flex items-center gap-1.5"
        style={{ fontSize: 13, color: "var(--text-muted)" }}
      >
        <Clock size={12} aria-hidden="true" />
        {workflow.last_run_at
          ? `Last run: ${relativeTime(new Date(workflow.last_run_at))}`
          : "Never run yet"}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={<Zap size={12} aria-hidden="true" />}>
          {workflow.run_count ?? 0} runs this month
        </Chip>
        <Chip icon={<CheckCircle size={12} aria-hidden="true" />}>
          {workflow.successful_runs} successful
        </Chip>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GhostButton
          onClick={() =>
            navigate({
              to: "/dashboard/workflows/builder/$workflowId",
              params: { workflowId: workflow.id },
            })
          }
        >
          <Pencil size={13} aria-hidden="true" />
          Edit
        </GhostButton>
        <GhostButton onClick={onToggleStatus} disabled={busy}>
          {isPublished ? (
            <Pause size={13} aria-hidden="true" />
          ) : (
            <Play size={13} aria-hidden="true" />
          )}
          {isPublished ? "Pause" : "Resume"}
        </GhostButton>
        <GhostButton
          onClick={() => navigate({ to: "/dashboard/activity", search: { workflow: workflow.id } })}
        >
          <List size={13} aria-hidden="true" />
          View logs
        </GhostButton>

        <div className="relative ml-auto" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            onClick={() => setMenuOpen((open) => !open)}
            className="synkra-focus rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              padding: "6px 8px",
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
              {[
                { label: "Duplicate workflow", action: onDuplicate },
                { label: "Rename workflow", action: onRename },
                { label: "Delete workflow", action: onDelete, danger: true },
              ].map((item) => (
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
    </article>
  );
}
