import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { formatDuration } from "@/lib/utils/time";
import type { ActivityRun } from "@/hooks/useActivityRuns";

export function RunStatusBadge({ status }: { status: ActivityRun["status"] }) {
  const config =
    status === "success"
      ? { label: "SUCCESS", color: "var(--state-success)", bg: "var(--state-success-bg)" }
      : status === "failed"
        ? { label: "FAILED", color: "var(--state-error)", bg: "var(--state-error-bg)" }
        : { label: "RUNNING", color: "var(--state-info)", bg: "var(--state-info-bg)" };

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        padding: "3px 8px",
        borderRadius: 999,
      }}
    >
      {status === "success" && <CheckCircle size={12} aria-hidden="true" />}
      {status === "failed" && <XCircle size={12} aria-hidden="true" />}
      {status === "running" && (
        <span
          className="synkra-pulse-scale"
          style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: config.color }}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}

/** Counts up from the triggered time while a run is still going. */
export function LiveTimer({ from }: { from: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const seconds = Math.max(0, Math.floor((now - from.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return <>{minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`}</>;
}

export function RunDuration({ run }: { run: ActivityRun }) {
  if (run.status === "running") return <LiveTimer from={run.triggeredAt} />;
  return <>{formatDuration(run.durationMs)}</>;
}

export function StepsSummary({ run }: { run: ActivityRun }) {
  const total = run.totalSteps || run.stepLogs.length;
  const completed = run.stepLogs.filter((s) => s.success).length;
  if (run.status === "running") {
    return (
      <span style={{ fontSize: 13, color: "var(--state-info)" }}>
        {run.stepLogs.length}/{total || "?"}...
      </span>
    );
  }
  if (run.status === "failed") {
    return (
      <span style={{ fontSize: 13, color: "var(--state-error)" }}>
        {completed}/{total || run.stepLogs.length}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 13, color: "var(--state-success)" }}>
      {completed}/{total || completed}
    </span>
  );
}

export function CodeBlock({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <pre
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: 12,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 12,
        color: "var(--text-secondary)",
        whiteSpace: "pre-wrap",
        overflowX: "auto",
      }}
    >
      {text}
    </pre>
  );
}

export const TRIGGER_LABELS: Record<string, string> = {
  webhook: "Webhook",
  schedule: "Schedule",
  email_received: "Email received",
};
