/**
 * Billing tab: current plan, upgrade actions and payment history.
 *
 * Every read and every upgrade goes through a server function that re-verifies
 * the caller's PocketBase token. The upgrade reuses the signed-in account's own
 * email, so the existing user id (and its data) is kept — never replaced.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import {
  getBillingOverviewFn,
  getPlanChangeContextFn,
  schedulePlanChangeFn,
  cancelScheduledPlanChangeFn,
  startUpgradeFn,
} from "@/lib/billing/billing.functions";
import { formatZar, isPurchasableTier, type PurchasableTier } from "@/lib/billing/config";
import type { PlanChangeContext } from "@/lib/billing/plan-changes.server";
import {
  getPlanLimits,
  getPlanName,
  integrationsAllowed,
  normalizeTier,
  INTEGRATIONS_PAID_PLAN_NOTE,
} from "@/lib/plans";
import type { BillingOverview } from "@/lib/billing/billing.server";

type Result = Record<string, unknown> & { ok?: boolean; message?: string };

function unwrap(result: Result): Result {
  if (result && result.ok === false) {
    throw new Error(typeof result.message === "string" ? result.message : "Action not allowed.");
  }
  return result;
}

function token(): string {
  const value = pb.authStore.token;
  if (!value) throw new Error("Not authenticated");
  return value;
}

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-ZA");
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
    >
      {children}
    </div>
  );
}

export function BillingSettings() {
  const { user } = useAuth();

  const overview = useQuery({
    queryKey: ["billing-overview", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () =>
      unwrap(
        (await getBillingOverviewFn({ data: { token: token() } })) as unknown as Result,
      ) as unknown as BillingOverview,
    staleTime: 15000,
  });

  const queryClient = useQueryClient();

  // Plan changes are governed entirely by the server: which switches are
  // possible, when they take effect, and what is already scheduled.
  const planChange = useQuery({
    queryKey: ["plan-change-context", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () =>
      unwrap(
        (await getPlanChangeContextFn({ data: { token: token() } })) as unknown as Result,
      ) as unknown as PlanChangeContext,
    staleTime: 15000,
  });

  const refreshBilling = () => {
    void queryClient.invalidateQueries({ queryKey: ["plan-change-context", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["billing-overview", user?.id] });
  };

  const upgrade = useMutation({
    mutationFn: async (tier: PurchasableTier) => {
      const result = unwrap(
        (await startUpgradeFn({ data: { token: token(), tier } })) as unknown as Result,
      );
      const url = typeof result["authorizationUrl"] === "string" ? result["authorizationUrl"] : "";
      if (!url) throw new Error("Card payments are not available right now.");
      window.location.href = url;
      return result;
    },
  });

  const schedule = useMutation({
    mutationFn: async (tier: string) =>
      unwrap(
        (await schedulePlanChangeFn({
          data: { token: token(), tier: tier as "free" | PurchasableTier },
        })) as unknown as Result,
      ),
    onSuccess: refreshBilling,
  });

  const cancelChange = useMutation({
    mutationFn: async () =>
      unwrap(
        (await cancelScheduledPlanChangeFn({ data: { token: token() } })) as unknown as Result,
      ),
    onSuccess: refreshBilling,
  });

  if (overview.isLoading) {
    return (
      <div className="space-y-4">
        <Shimmer height={120} radius={12} />
        <Shimmer height={200} radius={12} />
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <SectionError label="billing" onRetry={() => void overview.refetch()} />
    );
  }

  const data = overview.data;
  const currentTier = normalizeTier(data.tier);
  const context = planChange.data ?? null;
  const scheduled = context?.scheduled ?? null;
  const options = context?.options ?? [];
  // With no active billing period there is nothing to schedule against, so the
  // account pays now instead — the server decides this, never the browser.
  const payNow = !context || context.requiresCheckout;
  const changeError = schedule.error ?? cancelChange.error ?? upgrade.error;


  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Current plan
            </p>
            <p className="mt-1 text-[20px] font-bold">{data.planName}</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {data.priceCents > 0 ? `${formatZar(data.priceCents)} per month` : "No charge"}
              {data.subscription
                ? ` · renews ${formatDate(data.subscription.currentPeriodEnd)}`
                : ""}
            </p>
          </div>
          {data.subscription && (
            <span
              className="rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ backgroundColor: "var(--border-default)", color: "var(--text-secondary)" }}
            >
              {data.subscription.status}
            </span>
          )}
        </div>
        {!integrationsAllowed(currentTier) && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {INTEGRATIONS_PAID_PLAN_NOTE}
          </p>
        )}
      </Card>

      {scheduled && (
        <Card>
          <h2 className="text-[16px] font-semibold">Scheduled plan change</h2>
          <p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            You are moving from <strong>{scheduled.fromPlanName}</strong> to{" "}
            <strong>{scheduled.toPlanName}</strong>. This takes effect on{" "}
            <strong>{formatDate(scheduled.effectiveAt)}</strong>, the start of your next billing
            period. Your current plan and its limits stay active until then, and nothing is
            charged, refunded or credited for the current period.
          </p>
          {scheduled.amountCents > 0 && (
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
              From that date you will be charged {formatZar(scheduled.amountCents)} per month.
            </p>
          )}
          {scheduled.cancellable && (
            <button
              type="button"
              disabled={cancelChange.isPending}
              onClick={() => cancelChange.mutate()}
              className="mt-4 flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                opacity: cancelChange.isPending ? 0.6 : 1,
              }}
            >
              {cancelChange.isPending && <Loader2 size={14} className="animate-spin" />}
              Cancel scheduled change
            </button>
          )}
        </Card>
      )}

      {options.length > 0 && (
        <Card>
          <h2 className="text-[16px] font-semibold">Change plan</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {payNow
              ? "You have no active billing period yet, so a new plan starts with a payment."
              : `Any change takes effect on ${formatDate(
                  context?.effectiveAt ?? "",
                )} — the start of your next billing period. Your current plan and limits stay active until then, with no refund or credit for the current period.`}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {options.map((option) => {
              const isUpgrade = option.direction === "upgrade";
              const busy = schedule.isPending || upgrade.isPending;
              const canPayNow = payNow && isPurchasableTier(option.tier);
              return (
                <div
                  key={option.tier}
                  className="flex items-center justify-between rounded-lg p-4"
                  style={{ border: "1px solid var(--border-default)" }}
                >
                  <div>
                    <p className="text-[14px] font-semibold">{option.planName}</p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {option.priceCents > 0
                        ? `${formatZar(option.priceCents)} / month`
                        : "No charge"}{" "}
                      · {getPlanLimits(option.tier).seats} seats
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || (payNow && !canPayNow)}
                    onClick={() =>
                      canPayNow
                        ? upgrade.mutate(option.tier as PurchasableTier)
                        : schedule.mutate(option.tier)
                    }
                    className="flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold"
                    style={{
                      backgroundColor: isUpgrade ? "var(--accent-green)" : "transparent",
                      border: isUpgrade ? "none" : "1px solid var(--border-default)",
                      color: isUpgrade ? "var(--bg-base)" : "var(--text-primary)",
                      opacity: busy || (payNow && !canPayNow) ? 0.6 : 1,
                    }}
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isUpgrade ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {canPayNow ? "Upgrade" : isUpgrade ? "Schedule upgrade" : "Schedule downgrade"}
                  </button>
                </div>
              );
            })}
          </div>
          {changeError && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--state-error)" }} role="alert">
              {changeError instanceof Error ? changeError.message : "Plan change failed."}
            </p>
          )}
        </Card>
      )}


      <Card>
        <h2 className="text-[16px] font-semibold">Payment history</h2>
        {data.payments.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            No payments yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead style={{ color: "var(--text-muted)" }}>
                <tr>
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                    <td className="py-2">{formatDate(payment.paidAt)}</td>
                    <td className="py-2">{payment.planName}</td>
                    <td className="py-2">{formatZar(payment.amountCents)}</td>
                    <td className="py-2">{payment.status}</td>
                    <td className="py-2" style={{ color: "var(--text-muted)" }}>
                      {payment.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
                    }
                    
