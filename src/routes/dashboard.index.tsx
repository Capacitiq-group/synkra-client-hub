import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useTemplates } from "@/hooks/useTemplates";
import { useRecentRuns, type RecentRun } from "@/hooks/useRecentRuns";
import { greetingFor } from "@/lib/utils/time";
import { StatsRow } from "@/components/dashboard/stats-row";
import { WorkflowsSection, type WorkflowRecord } from "@/components/dashboard/workflows-section";
import { TemplatesSection } from "@/components/dashboard/templates-section";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CreditsWidget } from "@/components/dashboard/credits-widget";
import { QuickActions } from "@/components/dashboard/quick-actions";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Synkra Client Portal" },
      { name: "description", content: "Overview of your Synkra automation workflows." },
      { property: "og:title", content: "Dashboard — Synkra Client Portal" },
      { property: "og:description", content: "Overview of your Synkra automation workflows." },
    ],
  }),
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const stats = useDashboardStats();
  const templates = useTemplates();
  const runs = useRecentRuns();

  const workflows = useQuery<WorkflowRecord[]>({
    queryKey: ["workflows", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const records = await pb.collection("workflows").getFullList({
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        sort: "-updated",
      });
      return records as unknown as WorkflowRecord[];
    },
    staleTime: 10000,
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    pb.collection("workflow_runs")
      .subscribe("*", (event) => {
        if (!active) return;
        if ((event.record as { user_id?: string }).user_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ["recent-runs"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      pb.collection("workflow_runs").unsubscribe("*");
    };
  }, [user, queryClient]);

  const name = user?.name?.trim() || user?.email?.split("@")[0] || "there";
  const greeting = `${greetingFor(new Date())}, ${name}.`;

  const s = stats.data;
  let context = "Your automation dashboard is ready. Activate a template to get started.";
  if (s) {
    const emailPctRemaining =
      s.emailCreditsTotal > 0 ? (s.emailCreditsRemaining / s.emailCreditsTotal) * 100 : 100;
    const runsRemainingPct =
      s.workflowCreditsTotal > 0
        ? ((s.workflowCreditsTotal - s.workflowCreditsUsed) / s.workflowCreditsTotal) * 100
        : 100;
    if (s.failedTodayCount > 0) {
      context = `${s.failedTodayCount} workflow run${s.failedTodayCount === 1 ? "" : "s"} failed today. Check your activity log.`;
    } else if (s.daysRemaining !== null && s.daysRemaining <= 7) {
      context = `Your free trial ends in ${s.daysRemaining} days. We will let you know what happens next.`;
    } else if (emailPctRemaining < 20) {
      context = `Your email credits are running low. ${s.emailCreditsRemaining} remaining.`;
    } else if (runsRemainingPct < 20) {
      context = `Your workflow run credits are running low. ${s.workflowCreditsTotal - s.workflowCreditsUsed} remaining.`;
    } else if (s.activeCount > 0) {
      context = `${s.activeCount} automation${s.activeCount === 1 ? "" : "s"} running. Everything looks good.`;
    }
  }

  const handleRetryRun = (run: RecentRun) => {
    toast(`Retry queued for ${run.workflowName}`);
  };

  const isPaid = user?.user_type === "paid";

  return (
    <div className="mx-auto w-full text-left" style={{ maxWidth: 1200, padding: 16 }}>
      <div className="md:hidden" />
      <div className="synkra-dashboard flex flex-col">
        <header>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
            {greeting}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 8 }}>{context}</p>
        </header>

        <section aria-label="Account statistics">
          <StatsRow
            {...(stats.data ? { stats: stats.data } : {})}
            isLoading={stats.isLoading}
            isError={stats.isError}
            onRetry={() => stats.refetch()}
            isPaid={isPaid}
            nextBillingDate={null}
          />
        </section>

        <WorkflowsSection
          workflows={workflows.data ?? []}
          isLoading={workflows.isLoading}
          isError={workflows.isError}
          onRetry={() => workflows.refetch()}
        />

        <TemplatesSection
          templates={templates.data ?? []}
          isLoading={templates.isLoading}
          isError={templates.isError}
          onRetry={() => templates.refetch()}
          userId={user?.id}
        />

        <RecentActivity
          runs={runs.data ?? []}
          isLoading={runs.isLoading}
          isError={runs.isError}
          onRetry={() => runs.refetch()}
          onRetryRun={handleRetryRun}
        />

        {!isPaid && s && <CreditsWidget stats={s} />}
      </div>

      <QuickActions />
    </div>
  );
}
