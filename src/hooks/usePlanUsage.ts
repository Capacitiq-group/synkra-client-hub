// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPlanLimits,
  normalizeTier,
  safeUsage,
  type PlanLimits,
  type PlanTier,
} from "@/lib/plans";

export interface PlanUsage {
  tier: PlanTier;
  limits: PlanLimits;
  executionsUsed: number;
  aiOpsUsed: number;
  storageUsedMb: number;
  emailsUsed: number;
  billingPeriodStart: string | null;
}

/** Reads the live usage counters off the PocketBase `users` record. */
export function usePlanUsage() {
  const { user } = useAuth();

  return useQuery<PlanUsage>({
    queryKey: ["plan-usage", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const record = (await pb
        .collection("users")
        .getOne(user.id)) as unknown as Record<string, unknown>;

      const tier = normalizeTier(record["tier"]);
      const rawStart = record["billing_period_start"];

      return {
        tier,
        limits: getPlanLimits(tier),
        executionsUsed: safeUsage(record["executions_used_this_month"]),
        aiOpsUsed: safeUsage(record["ai_ops_used_this_month"]),
        storageUsedMb: safeUsage(record["storage_used_mb"]),
        emailsUsed: safeUsage(record["emails_used_this_month"]),
        billingPeriodStart: typeof rawStart === "string" && rawStart ? rawStart : null,
      };
    },
    staleTime: 15000,
    refetchInterval: 60000,
  });
}
