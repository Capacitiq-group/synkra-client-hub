import { useEffect, useRef, useState } from "react";
import { Braces } from "lucide-react";
import type { VariableOption } from "@/lib/workflow/describe";

/**
 * Popover listing the information available from earlier steps.
 *
 * Users see a plain-language name and a one-line explanation; the literal
 * {{...}} token is what actually gets inserted into the field.
 */
export function VariablesPopover({
  variables,
  onInsert,
}: {
  variables: VariableOption[];
  onInsert: (variable: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="synkra-focus inline-flex items-center gap-1 rounded-md"
        style={{ fontSize: 12, color: "var(--accent-green)", padding: "2px 4px" }}
      >
        <Braces size={12} aria-hidden="true" />
        Insert variable
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 max-h-64 w-64 overflow-auto"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
            padding: 6,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "6px 8px",
            }}
          >
            Information you can use
          </p>
          {variables.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 8px" }}>
              Add a trigger first to see variables.
            </p>
          ) : (
            variables.map((variable) => (
              <button
                key={variable.token}
                type="button"
                role="menuitem"
                onClick={() => {
                  onInsert(variable.token);
                  setOpen(false);
                }}
                className="synkra-focus block w-full rounded-sm text-left"
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  padding: "6px 8px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <span style={{ display: "block", fontWeight: 600, color: "var(--text-primary)" }}>
                  {variable.label}
                </span>
                <span style={{ display: "block", color: "var(--text-muted)", marginTop: 2 }}>
                  {variable.description}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "8px 10px",
};

/** Labelled text field with a variables popover that inserts at the caret. */
export function VariableField({
  label,
  value,
  onChange,
  variables,
  multiline,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variables: VariableOption[];
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const insert = (variable: string) => {
    const element = ref.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${variable}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      const caret = start + variable.length;
      element?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          {label}
        </label>
        <VariablesPopover variables={variables} onInsert={insert} />
      </div>
      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          rows={4}
          placeholder={placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="synkra-focus"
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          value={value}
          placeholder={placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="synkra-focus"
          style={fieldStyle}
        />
      )}
      {hint && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export function PlainField({
  label,
  value,
  onChange,
  type = "text",
  options,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block"
        style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="synkra-focus"
          style={fieldStyle}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="synkra-focus"
          style={fieldStyle}
        />
      )}
      {hint && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}
