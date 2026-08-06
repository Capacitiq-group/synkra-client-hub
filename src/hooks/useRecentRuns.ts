// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb, { getListSafe } from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";

export interface RecentRun {
  id: string;
  workflowName: string;
  workflowId: string;
  status: "running" | "success" | "failed";
  triggeredAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export function useRecentRuns() {
  const { user } = useAuth();

  return useQuery<RecentRun[]>({
    queryKey: ["recent-runs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const runs = await getListSafe<Record<string, unknown> & { id: string; expand?: unknown }>("workflow_runs", 1, 5, {
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        sort: "-triggered_at",
        expand: "workflow_id",
      });

      return runs.items.map((run) => {
        const expanded = (run.expand as { workflow_id?: { name?: string } } | undefined)?.[
          "workflow_id"
        ];
        return {
          id: run.id,
          workflowName: expanded?.name || (run["workflow_name"] as string) || "Unknown workflow",
          workflowId: run["workflow_id"] as string,
          status: run["status"] as RecentRun["status"],
          triggeredAt: new Date(run["triggered_at"] as string),
          completedAt: run["completed_at"] ? new Date(run["completed_at"] as string) : null,
          durationMs: (run["duration_ms"] as number | null) ?? null,
          errorMessage: (run["error_message"] as string | null) ?? null,
        };
      });
    },
    refetchInterval: 15000,
    staleTime: 5000,
  });
}
