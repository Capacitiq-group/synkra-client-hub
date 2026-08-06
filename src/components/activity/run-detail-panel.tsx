import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  MinusCircle,
  Pencil,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import pb from "@/lib/pocketbase";
import { retryRun } from "@/lib/workflow/api";
import { explainError, fullDateTime, needsReconnect } from "@/lib/workflow/errors";
import { formatDuration } from "@/lib/utils/time";
import { mapRun, type ActivityRun, type StepLog } from "@/hooks/useActivityRuns";
import { CodeBlock, LiveTimer, RunStatusBadge } from "./activity-primitives";

function StepOutput({ output }: { output: unknown }) {
  const [open, setOpen] = useState(false);
  if (output === undefined || output === null) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="synkra-focus rounded-sm"
        style={{ fontSize: 12, color: "var(--accent-green)" }}
      >
        {open ? "Hide output" : "Show output"}
      </button>
      {open && (
        <div className="mt-2">
          <CodeBlock value={output} />
        </div>
      )}
    </div>
  );
}

function StepRow({
  step,
  index,
  status,
  workflowId,
}: {
  step: StepLog;
  index: number;
  status: ActivityRun["status"];
  workflowId: string;
}) {
  const navigate = useNavigate();
  const state: "success" | "failed" | "running" | "pending" =
    step.success === true
      ? "success"
      : step.error || step.success === false
        ? "failed"
        : status === "running"
          ? "running"
          : "pending";

  const barColor =
    state === "success"
      ? "var(--state-success)"
      : state === "failed"
        ? "var(--state-error)"
        : state === "running"
          ? "var(--state-info)"
          : "var(--state-warning)";

  const explanation = step.error ? explainError(step.error) : null;

  return (
    <div
      style={{
        borderLeft: `3px solid ${barColor}`,
        paddingLeft: 12,
        marginBottom: 14,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>
          Step {index + 1}
        </span>
        <span
          className="min-w-0 flex-1 truncate"
          style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
        >
          {step.label ?? step.block_id ?? "Step"}
        </span>
        {state === "success" && (
          <CheckCircle size={14} style={{ color: "var(--state-success)" }} aria-label="Success" />
        )}
        {state === "failed" && (
          <XCircle size={14} style={{ color: "var(--state-error)" }} aria-label="Failed" />
        )}
        {state === "running" && (
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: "var(--state-info)" }}
            aria-label="Running"
          />
        )}
        {state === "pending" && (
          <MinusCircle size={14} style={{ color: "var(--text-muted)" }} aria-label="Pending" />
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {step.duration_ms ? formatDuration(step.duration_ms) : ""}
        </span>
      </div>

      {state === "failed" && step.error ? (
        <div
          className="mt-2"
          style={{
            backgroundColor: "var(--state-error-bg)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--state-error)" }}>
            {step.error}
          </p>
          {explanation && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              {explanation}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {needsReconnect(step.error) && (
              <button
                type="button"
                onClick={() => navigate({ to: "/dashboard/settings", search: { tab: "integrations" } })}
                className="synkra-focus inline-flex items-center gap-1.5 rounded-md border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  padding: "6px 12px",
                }}
              >
                <LinkIcon size={13} aria-hidden="true" />
                Reconnect
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/dashboard/workflows/builder/$workflowId",
                  params: { workflowId },
                })
              }
              className="synkra-focus inline-flex items-center gap-1.5 rounded-md border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                fontSize: 13,
                padding: "6px 12px",
              }}
            >
              <Pencil size={13} aria-hidden="true" />
              Edit workflow
            </button>
          </div>
        </div>
      ) : (
        <StepOutput output={step.output} />
      )}
    </div>
  );
}

export function RunDetailPanel({
  run,
  onClose,
  fullScreen,
}: {
  run: ActivityRun;
  onClose: () => void;
  fullScreen?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inputOpen, setInputOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    void pb.collection("workflow_runs").subscribe(run.id, (event) => {
      if (!active || event.action !== "update") return;
      queryClient.setQueryData(
        ["run-detail", run.id],
        mapRun(event.record as unknown as Record<string, unknown>),
      );
      void queryClient.invalidateQueries({ queryKey: ["activity-runs"] });
    });
    return () => {
      active = false;
      void pb.collection("workflow_runs").unsubscribe(run.id);
    };
  }, [run.id, queryClient]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryRun(run.workflowId, run.inputData);
      toast.success("Workflow is running again");
      await queryClient.invalidateQueries({ queryKey: ["activity-runs"] });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry this run");
    } finally {
      setRetrying(false);
    }
  };

  const body = (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-base)" }}>
      <header
        className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4"
        style={{ height: 56, borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="min-w-0">
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            RUN-{run.id.slice(0, 8).toUpperCase()}
          </span>
          <p
            className="truncate"
            style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
          >
            {run.workflowName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open this run as a full page"
            className="synkra-focus rounded-sm"
            onClick={() => navigate({ to: "/dashboard/activity", search: { run: run.id } })}
          >
            <ExternalLink size={15} style={{ color: "var(--text-muted)" }} />
          </button>
          <button type="button" aria-label="Close" className="synkra-focus rounded-sm" onClick={onClose}>
            <X size={16} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-wrap items-center gap-4" style={{ fontSize: 13 }}>
          <RunStatusBadge status={run.status} />
          <span
            style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-subtle)", paddingLeft: 16 }}
          >
            {fullDateTime(run.triggeredAt)}
          </span>
          <span
            style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-subtle)", paddingLeft: 16 }}
          >
            {run.status === "running" ? (
              <LiveTimer from={run.triggeredAt} />
            ) : (
              formatDuration(run.durationMs)
            )}
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "16px 0" }} />

        {run.stepLogs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No steps have been recorded for this run yet.
          </p>
        ) : (
          run.stepLogs.map((step, index) => (
            <StepRow
              key={step.block_id ?? index}
              step={step}
              index={index}
              status={run.status}
              workflowId={run.workflowId}
            />
          ))
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setInputOpen((v) => !v)}
            className="synkra-focus flex items-center gap-1.5 rounded-sm"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {inputOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            TRIGGER INPUT
          </button>
          {inputOpen && (
            <div className="mt-2">
              <CodeBlock value={run.inputData} />
            </div>
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-2 p-4"
        style={{ borderTop: "1px solid var(--border-default)" }}
      >
        {run.status === "failed" && (
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="synkra-focus inline-flex w-full items-center justify-center gap-2 rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 14,
              padding: "10px 12px",
              opacity: retrying ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
            {retrying ? "Retrying" : "Retry workflow"}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/dashboard/workflows/builder/$workflowId",
              params: { workflowId: run.workflowId },
            })
          }
          className="synkra-focus w-full rounded-md"
          style={{ color: "var(--text-secondary)", fontSize: 14, padding: "10px 12px" }}
        >
          Open in builder
        </button>
      </div>
    </div>
  );

  if (fullScreen) {
    return <div className="fixed inset-0 z-[60]">{body}</div>;
  }

  return (
    <div
      className="synkra-drawer-in fixed inset-y-0 right-0 z-[60]"
      style={{ width: 480, borderLeft: "1px solid var(--border-default)" }}
      role="dialog"
      aria-label="Run detail"
    >
      {body}
    </div>
  );
}
