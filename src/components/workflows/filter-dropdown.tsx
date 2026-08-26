import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Compact multi-select filter popover. Options are always passed in from the
 * data, so new categories or integrations appear here without any UI change
 * and the page never grows a permanent wall of chips.
 */
export function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: FilterOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = selected.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="synkra-focus inline-flex items-center gap-1.5"
        style={{
          backgroundColor: active ? "var(--accent-green-subtle)" : "transparent",
          border: `1px solid ${active ? "var(--accent-green-border)" : "var(--border-default)"}`,
          color: active ? "var(--accent-green)" : "var(--text-secondary)",
          borderRadius: "var(--radius-full)",
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {active && <span style={{ fontSize: 12 }}>({selected.length})</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 z-40 mt-2 max-h-72 overflow-y-auto"
          style={{
            minWidth: 220,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: 6,
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
          }}
        >
          {options.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 10px" }}>
              Nothing to filter yet.
            </p>
          ) : (
            <>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => onToggle(option.value)}
                    className="synkra-focus flex w-full items-center justify-between gap-3 rounded-md text-left"
                    style={{
                      padding: "7px 10px",
                      fontSize: 13,
                      color: checked ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    <span>{option.label}</span>
                    {checked && (
                      <Check size={14} aria-hidden="true" style={{ color: "var(--accent-green)" }} />
                    )}
                  </button>
                );
              })}
              {active && (
                <button
                  type="button"
                  onClick={onClear}
                  className="synkra-focus mt-1 w-full rounded-md text-left"
                  style={{
                    padding: "7px 10px",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  Clear {label.toLowerCase()}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
                  }
