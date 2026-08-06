import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Shimmer, StatusBadge, SectionError, SectionHeading } from "./primitives";
import { relativeTime, formatDuration } from "@/lib/utils/time";
import type { RecentRun } from "@/hooks/useRecentRuns";

export function RecentActivity({
  runs,
  isLoading,
  isError,
  onRetry,
  onRetryRun,
}: {
  runs: RecentRun[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRetryRun: (run: RecentRun) => void;
}) {
  const navigate = useNavigate();
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const topId = runs[0]?.id ?? null;

  useEffect(() => {
    if (!topId) return;
    setHighlighted(topId);
    const timeout = setTimeout(() => setHighlighted(null), 2000);
    return () => clearTimeout(timeout);
  }, [topId]);

  const rowBackground = (id: string) =>
    highlighted === id ? "var(--accent-green-subtle)" : "transparent";

  return (
    <section aria-label="Recent activity">
      <SectionHeading
        title="Recent activity"
        action={
          <Link
            to="/dashboard/activity"
            className="synkra-focus rounded-sm"
            style={{ fontSize: 13, color: "var(--accent-green)" }}
          >
            View all
          </Link>
        }
      />

      {isError ? (
        <SectionError label="recent activity" onRetry={onRetry} />
      ) : isLoading ? (
        <div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center"
              style={{ height: 52, borderBottom: "1px solid var(--border-subtle)" }}
            >
              <Shimmer height={13} />
            </div>
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "24px 0" }}>
          No runs yet. Publish a workflow to see activity here.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full md:table" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Workflow", "Triggered", "Status", "Duration", "Actions"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    style={{
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "0 12px 10px 0",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  style={{
                    height: 52,
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: rowBackground(run.id),
                    transition: "background-color 100ms ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = rowBackground(run.id))
                  }
                >
                  <td
                    className="max-w-[240px] truncate"
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      paddingRight: 12,
                    }}
                  >
                    {run.workflowName}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-muted)", paddingRight: 12 }}>
                    {relativeTime(run.triggeredAt)}
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <StatusBadge status={run.status} small />
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-muted)", paddingRight: 12 }}>
                    {formatDuration(run.durationMs)}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="synkra-focus rounded-sm"
                        style={{ fontSize: 13, color: "var(--accent-green)" }}
                        onClick={() =>
                          navigate({ to: "/dashboard/activity", search: { run: run.id } })
                        }
                      >
                        View
                      </button>
                      {run.status === "failed" && (
                        <button
                          type="button"
                          className="synkra-focus rounded-sm"
                          style={{ fontSize: 13, color: "var(--state-error)" }}
                          onClick={() => onRetryRun(run)}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {runs.map((run) => (
              <div
                key={run.id}
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: 16,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                  >
                    {run.workflowName}
                  </span>
                  <StatusBadge status={run.status} small />
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                  {relativeTime(run.triggeredAt)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                  {formatDuration(run.durationMs)}
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    className="synkra-focus rounded-sm"
                    style={{ fontSize: 13, color: "var(--accent-green)" }}
                    onClick={() => navigate({ to: "/dashboard/activity", search: { run: run.id } })}
                  >
                    View
                  </button>
                  {run.status === "failed" && (
                    <button
                      type="button"
                      className="synkra-focus rounded-sm"
                      style={{ fontSize: 13, color: "var(--state-error)" }}
                      onClick={() => onRetryRun(run)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
