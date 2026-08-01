import { AlertCircle } from "lucide-react";

export function Shimmer({
  height,
  width,
  radius = 6,
}: {
  height: number;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="synkra-skeleton"
      style={{ height, width: width ?? "100%", borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="text-left">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} style={{ color: "var(--state-error)" }} aria-hidden="true" />
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Could not load {label}.
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="synkra-focus mt-2 rounded-sm"
        style={{ fontSize: 13, color: "var(--accent-green)" }}
      >
        Try again
      </button>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  published: { label: "RUNNING", bg: "var(--state-success-bg)", color: "var(--state-success)" },
  running: { label: "RUNNING", bg: "var(--state-info-bg)", color: "var(--state-info)" },
  success: { label: "SUCCESS", bg: "var(--state-success-bg)", color: "var(--state-success)" },
  failed: { label: "FAILED", bg: "var(--state-error-bg)", color: "var(--state-error)" },
  error: { label: "ERROR", bg: "var(--state-error-bg)", color: "var(--state-error)" },
  paused: { label: "PAUSED", bg: "var(--border-subtle)", color: "var(--text-muted)" },
  draft: { label: "DRAFT", bg: "var(--border-subtle)", color: "var(--text-muted)" },
};

export function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP["draft"]!;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        padding: small ? "2px 7px" : "2px 8px",
        borderRadius: 999,
        letterSpacing: "0.04em",
        transition: "background-color 200ms ease, color 200ms ease",
      }}
    >
      {status === "running" && (
        <span
          className="synkra-pulse-dot"
          style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: config.color }}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}

export function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const fill =
    pct > 95 ? "var(--state-error)" : pct > 80 ? "var(--state-warning)" : "var(--accent-green)";
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        backgroundColor: "var(--border-default)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          backgroundColor: fill,
          transition: "width 300ms ease, background-color 200ms ease",
        }}
      />
    </div>
  );
}

export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
      {action}
    </div>
  );
}
