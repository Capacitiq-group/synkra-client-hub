// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { deliverNotificationEventFn } from "@/lib/notifications.functions";

/**
 * Raises the low balance warning at most once per credit allocation.
 *
 * Delivery is decided server-side (`deliverNotificationEventFn`): the in-app
 * notification is written for every tier, and the email is sent for every tier
 * too, because credit-balance alerts are not a paid-only email. The toggle is
 * still re-checked on the server, so this call is a no-op when the user turned
 * "Credit balance low" off.
 */
function maybeWarnLowCredits(userId: string, remaining: number, total: number) {
  if (typeof window === "undefined" || total <= 0) return;
  if (remaining / total >= 0.2) return;
  const key = `synkra-credit-warning-${userId}-${total}`;
  if (localStorage.getItem(key)) return;
  const token = pb.authStore.token;
  if (!token) return;
  localStorage.setItem(key, "sent");
  void deliverNotificationEventFn({
    data: {
      token,
      eventType: "credit_balance_low",
      title: "Your Synkra email credits are running low",
      message: `You have ${remaining} of ${total} email credits remaining, which is under 20 percent. Email automations pause automatically once your credits run out.`,
      link: "/dashboard/settings?tab=usage",
      dedupeKey: `credit_balance_low:emails:${userId}:${total}`,
    },
  }).catch(() => {
    // Allow a retry on the next poll when the call itself failed.
    localStorage.removeItem(key);
  });
}

export interface DashboardStats {
  activeCount: number;
  pausedCount: number;
  errorCount: number;
  totalWorkflows: number;
  runsThisMonth: number;
  runsLimit: number;
  failedTodayCount: number;
  daysRemaining: number | null;
  emailCreditsUsed: number;
  emailCreditsTotal: number;
  emailCreditsRemaining: number;
  workflowCreditsUsed: number;
  workflowCreditsTotal: number;
}

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const workflows = await pb.collection("workflows").getFullList({
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
      });

      const activeWorkflows = workflows.filter((w) => w["status"] === "published");
      const pausedWorkflows = workflows.filter((w) => w["status"] === "paused");
      const errorWorkflows = workflows.filter((w) => w["status"] === "error");

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const runsThisMonth = await pb.collection("workflow_runs").getList(1, 1, {
        filter: pb.filter("user_id = {:userId} && triggered_at >= {:monthStart}", {
          userId: user.id,
          monthStart: monthStart.toISOString(),
        }),
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const failedToday = await pb.collection("workflow_runs").getList(1, 50, {
        filter: pb.filter(
          'user_id = {:userId} && status = "failed" && triggered_at >= {:todayStart}',
          { userId: user.id, todayStart: todayStart.toISOString() },
        ),
      });

      let daysRemaining: number | null = null;
      if (user.trial_ends_at) {
        const trialEnd = new Date(user.trial_ends_at);
        const now = new Date();
        daysRemaining = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        );
      }

      const emailCreditsTotal = user.credit_emails ?? 0;
      const emailCreditsUsed = user.credit_emails_used ?? 0;
      const workflowCreditsTotal = user.credit_workflows ?? 2000;
      const workflowCreditsUsed = user.credit_workflows_used ?? 0;

      if (user.notify_credit_low !== false) {
        maybeWarnLowCredits(
          user.id,
          Math.max(0, emailCreditsTotal - emailCreditsUsed),
          emailCreditsTotal,
        );
      }

      return {
        activeCount: activeWorkflows.length,
        pausedCount: pausedWorkflows.length,
        errorCount: errorWorkflows.length,
        totalWorkflows: workflows.length,
        runsThisMonth: runsThisMonth.totalItems,
        runsLimit: workflowCreditsTotal,
        failedTodayCount: failedToday.totalItems,
        daysRemaining,
        emailCreditsUsed,
        emailCreditsTotal,
        emailCreditsRemaining: Math.max(0, emailCreditsTotal - emailCreditsUsed),
        workflowCreditsUsed,
        workflowCreditsTotal,
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
        }
