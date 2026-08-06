// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb, { getFullListSafe, getListSafe } from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";

export interface StepLog {
  block_id?: string;
  label?: string;
  success?: boolean;
  output?: unknown;
  error?: string;
  duration_ms?: number;
}

export interface ActivityRun {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  status: "running" | "success" | "failed";
  triggeredAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  stepLogs: StepLog[];
  totalSteps: number;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  errorMessage: string | null;
}

export interface RunFilters {
  workflowId?: string | undefined;
  status?: "success" | "failed" | "running" | "all" | undefined;
  dateRange?: "today" | "7days" | "30days" | "all" | undefined;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

export function mapRun(record: Record<string, unknown>): ActivityRun {
  const expanded = (record["expand"] as { workflow_id?: Record<string, unknown> } | undefined)?.[
    "workflow_id"
  ];
  const stepLogs = parseJson<StepLog[]>(record["step_logs"], []);
  const blocks = parseJson<unknown[]>(expanded?.["blocks"], []);
  return {
    id: record["id"] as string,
    workflowId: (record["workflow_id"] as string) ?? "",
    workflowName: (expanded?.["name"] as string) || "Unknown workflow",
    triggerType: (expanded?.["trigger_type"] as string) || "webhook",
    status: (record["status"] as ActivityRun["status"]) ?? "running",
    triggeredAt: new Date(record["triggered_at"] as string),
    completedAt: record["completed_at"] ? new Date(record["completed_at"] as string) : null,
    durationMs: (record["duration_ms"] as number | null) ?? null,
    stepLogs,
    totalSteps: blocks.length || stepLogs.length,
    inputData: parseJson<Record<string, unknown>>(record["input_data"], {}),
    outputData: parseJson<Record<string, unknown>>(record["output_data"], {}),
    errorMessage: (record["error_message"] as string | null) ?? null,
  };
}

export interface ActivityPage {
  items: ActivityRun[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  counts: { total: number; success: number; failed: number; running: number };
}

function cutoffFor(range: NonNullable<RunFilters["dateRange"]>): Date | null {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "7days") return new Date(now.getTime() - 7 * 86400000);
  if (range === "30days") return new Date(now.getTime() - 30 * 86400000);
  return null;
}

export function useActivityRuns(filters: RunFilters = {}, page = 1) {
  const { user } = useAuth();

  return useQuery<ActivityPage>({
    queryKey: ["activity-runs", user?.id, filters, page],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const parts = [pb.filter("user_id = {:userId}", { userId: user.id })];
      if (filters.workflowId) {
        parts.push(pb.filter("workflow_id = {:workflowId}", { workflowId: filters.workflowId }));
      }
      if (filters.status && filters.status !== "all") {
        parts.push(pb.filter("status = {:status}", { status: filters.status }));
      }
      const cutoff = cutoffFor(filters.dateRange ?? "7days");
      if (cutoff) {
        parts.push(pb.filter("triggered_at >= {:cutoff}", { cutoff: cutoff.toISOString() }));
      }
      const filter = parts.join(" && ");

      const runs = await getListSafe<Record<string, unknown>>("workflow_runs", page, 20, {
        filter,
        sort: "-triggered_at",
        expand: "workflow_id",
      });


      const countsList = await getFullListSafe<Record<string, unknown>>("workflow_runs", {
        filter,
        fields: "status",
      });
      const counts = {
        total: countsList.length,
        success: countsList.filter((r) => r["status"] === "success").length,
        failed: countsList.filter((r) => r["status"] === "failed").length,
        running: countsList.filter((r) => r["status"] === "running").length,
      };

      return {
        items: runs.items.map((r) => mapRun(r as unknown as Record<string, unknown>)),
        totalItems: runs.totalItems,
        totalPages: runs.totalPages,
        currentPage: runs.page,
        counts,
      };
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });
}

export function useRunDetail(runId: string | null) {
  const { user } = useAuth();

  return useQuery<ActivityRun | null>({
    queryKey: ["run-detail", runId],
    enabled: Boolean(runId) && Boolean(user?.id),
    queryFn: async () => {
      if (!runId) return null;
      const record = await pb.collection("workflow_runs").getOne(runId, { expand: "workflow_id" });
      return mapRun(record as unknown as Record<string, unknown>);
    },
    staleTime: 0,
  });
}
