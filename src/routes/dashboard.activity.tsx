import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkflows } from "@/hooks/useWorkflows";
import { useActivityRuns, useRunDetail, type RunFilters } from "@/hooks/useActivityRuns";
import { ActivityFilters, StatsSummaryBar } from "@/components/activity/activity-filters";
import {
  RunDuration,
  RunStatusBadge,
  StepsSummary,
  TRIGGER_LABELS,
} from "@/components/activity/activity-primitives";
import { RunDetailPanel } from "@/components/activity/run-detail-panel";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { relativeTime } from "@/lib/utils/time";
import { fullDateTime } from "@/lib/workflow/errors";
import { retryRun } from "@/lib/workflow/api";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/dashboard/activity")({
  validateSearch: (search: Record<string, unknown>): { workflow?: string; run?: string } => ({
    ...(typeof search["workflow"] === "string" ? { workflow: search["workflow"] } : {}),
    ...(typeof search["run"] === "string" ? { run: search["run"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Activity — Synkra Client Portal" },
      { name: "description", content: "Run history and logs for your automations." },
      { property: "og:title", content: "Activity — Synkra Client Portal" },
      { property: "og:description", content: "Run history and logs for your automations." },
    ],
  }),
  component: ActivityPage,
});

const HEADERS: { label: string; width: string; align?: "right" }[] = [
  { label: "Workflow", width: "35%" },
  { label: "Triggered", width: "18%" },
  { label: "Status", width: "14%" },
  { label: "Duration", width: "12%" },
  { label: "Steps", width: "10%" },
  { label: "Actions", width: "11%", align: "right" },
];

function ActivityPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: workflows } = useWorkflows();

  const [filters, setFilters] = useState<RunFilters>({
    ...(search.workflow ? { workflowId: search.workflow } : {}),
    status: "all",
    dateRange: "7days",
  });
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(search.run ?? null);

  const { data, isLoading, isError, refetch } = useActivityRuns(filters, page);
  const { data: detail } = useRunDetail(selectedRunId);

  useEffect(() => {
    if (!user) return;
    void pb.collection("workflow_runs").subscribe("*", () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-runs"] });
    });
    return () => {
      void pb.collection("workflow_runs").unsubscribe("*");
    };
  }, [user, queryClient]);

  const workflowOptions = useMemo(
    () => (workflows ?? []).map((w) => ({ id: w.id, name: w.name })),
    [workflows],
  );

  const clearFilters = () => {
    setFilters({ status: "all", dateRange: "7days" });
    setPage(1);
  };

  const handleRetry = async (runId: string) => {
    const run = data?.items.find((r) => r.id === runId);
    if (!run) return;
    try {
      await retryRun(run.workflowId, run.inputData);
      toast.success("Retry triggered");
      void queryClient.invalidateQueries({ queryKey: ["activity-runs"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry this run");
    }
  };

  const runs = data?.items ?? [];
  const counts = data?.counts ?? { total: 0, success: 0, failed: 0, running: 0 };
  const filtered =
    Boolean(filters.workflowId) || filters.status !== "all" || filters.dateRange !== "7days";

  return (
    <div className="p-4 sm:p-6" style={{ paddingRight: !isMobile && detail ? 500 : undefined }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>Activity</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4, marginBottom: 20 }}>
        Every run of your automations, with step by step detail.
      </p>

      <ActivityFilters
        filters={filters}
        workflows={workflowOptions}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onClear={clearFilters}
      />

      <StatsSummaryBar counts={counts} />

      {isError ? (
        <SectionError label="activity" onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Shimmer key={i} height={40} />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="py-16 text-center">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            {filtered ? "No runs match your filters" : "No activity yet"}
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 6 }}>
            {filtered
              ? "Try widening the date range or clearing the filters."
              : "Publish a workflow and trigger it to see runs appear here."}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="synkra-focus mt-3 rounded-sm"
              style={{ fontSize: 13, color: "var(--accent-green)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <table className="hidden w-full md:table" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                {HEADERS.map((header) => (
                  <th
                    key={header.label}
                    scope="col"
                    style={{
                      width: header.width,
                      textAlign: header.align ?? "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "0 12px 10px 0",
                    }}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  style={{
                    height: 56,
                    borderBottom: "1px solid var(--border-subtle)",
                    transition: "background-color 100ms ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "var(--bg-elevated)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ paddingRight: 12 }}>
                    <div
                      className="truncate"
                      style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                    >
                      {run.workflowName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {TRIGGER_LABELS[run.triggerType] ?? "Webhook"}
                    </div>
                  </td>
                  <td
                    title={fullDateTime(run.triggeredAt)}
                    style={{ fontSize: 13, color: "var(--text-secondary)", paddingRight: 12 }}
                  >
                    {relativeTime(run.triggeredAt)}
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td style={{ fontSize: 13, color: "var(--text-secondary)", paddingRight: 12 }}>
                    <RunDuration run={run} />
                  </td>
                  <td style={{ paddingRight: 12 }}>
                    <StepsSummary run={run} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        className="synkra-focus rounded-sm"
                        style={{ fontSize: 13, color: "var(--accent-green)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRunId(run.id);
                        }}
                      >
                        View
                      </button>
                      {run.status === "failed" && (
                        <button
                          type="button"
                          className="synkra-focus rounded-sm"
                          style={{ fontSize: 13, color: "var(--state-error)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRetry(run.id);
                          }}
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
          <div className="md:hidden">
            {runs.map((run) => (
              <div
                key={run.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRunId(run.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedRunId(run.id)}
                className="synkra-focus"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: 16,
                  marginBottom: 8,
                }}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span
                    className="truncate"
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {run.workflowName}
                  </span>
                  <RunStatusBadge status={run.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {relativeTime(run.triggeredAt)}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    <RunDuration run={run} />
                  </span>
                </div>
                {run.status === "failed" && run.errorMessage && (
                  <p
                    className="mt-2 truncate"
                    style={{ fontSize: 13, color: "var(--state-error)" }}
                  >
                    {run.errorMessage}
                  </p>
                )}
                {run.status === "failed" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRetry(run.id);
                    }}
                    className="synkra-focus mt-3 w-full rounded-md border"
                    style={{
                      borderColor: "rgba(239,68,68,0.4)",
                      color: "var(--state-error)",
                      fontSize: 13,
                      padding: "8px 12px",
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data?.totalItems ?? 0)} of{" "}
              {data?.totalItems ?? 0} runs
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="synkra-focus rounded-md border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  padding: "6px 12px",
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="synkra-focus rounded-md border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  padding: "6px 12px",
                  opacity: page >= (data?.totalPages ?? 1) ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {detail && (
        <RunDetailPanel
          run={detail}
          fullScreen={isMobile}
          onClose={() => {
            setSelectedRunId(null);
            if (search.run) void navigate({ to: "/dashboard/activity", search: {} });
          }}
        />
      )}
    </div>
  );
}
