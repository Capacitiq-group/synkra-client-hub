import type { ReactNode } from "react";

export const fieldStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: 14,
  padding: "0 14px",
};

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
      <div className="mt-3 border-t pt-5" style={{ borderColor: "var(--border-default)" }}>
        {children}
      </div>
    </section>
  );
}

export function Field({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block"
        style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
      {note && (
        <span className="mt-1.5 block" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {note}
        </span>
      )}
    </label>
  );
}
