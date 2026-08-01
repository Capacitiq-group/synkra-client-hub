import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, LayoutTemplate, Workflow } from "lucide-react";

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const itemStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: 14,
    padding: "10px 14px",
  };

  return (
    <div ref={ref} className="fixed right-8 bottom-8 z-40 hidden flex-col items-end gap-3 md:flex">
      {open && (
        <div className="synkra-pop flex flex-col items-stretch gap-2">
          <button
            type="button"
            className="synkra-focus flex items-center gap-2"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              navigate({ to: "/dashboard/workflows/builder/new", search: {} });
            }}
          >
            <Workflow size={16} aria-hidden="true" />
            New workflow
          </button>
          <button
            type="button"
            className="synkra-focus flex items-center gap-2"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              navigate({ to: "/dashboard/workflows" });
            }}
          >
            <LayoutTemplate size={16} aria-hidden="true" />
            Browse templates
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label="Quick actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="synkra-focus flex items-center justify-center rounded-full"
        style={{
          width: 52,
          height: 52,
          backgroundColor: "var(--accent-green)",
          color: "#0A0A0A",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <Plus size={22} aria-hidden="true" />
      </button>
    </div>
  );
}
