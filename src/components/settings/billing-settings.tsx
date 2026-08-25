/**
 * Billing tab: current plan, upgrade actions and payment history.
 *
 * Every read and every upgrade goes through a server function that re-verifies
 * the caller's PocketBase token. The upgrade reuses the signed-in account's own
 * email, so the existing user id (and its data) is kept — never replaced.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Loader2 } from "lucide-react";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { getBillingOverviewFn, startUpgradeFn } from "@/lib/billing/billing.functions";
import { formatZar, PURCHASABLE_TIERS, type PurchasableTier } from "@/lib/billing/config";
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
  const upgrades = PURCHASABLE_TIERS.filter(
    (tier) => getPlanLimits(tier).priceZar > getPlanLimits(currentTier).priceZar,
  );

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

      {upgrades.length > 0 && (
        <Card>
          <h2 className="text-[16px] font-semibold">Upgrade</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Your account keeps its history, workflows and team when you move up a plan.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {upgrades.map((tier) => {
              const limits = getPlanLimits(tier);
              return (
                <div
                  key={tier}
                  className="flex items-center justify-between rounded-lg p-4"
                  style={{ border: "1px solid var(--border-default)" }}
                >
                  <div>
                    <p className="text-[14px] font-semibold">{getPlanName(tier)}</p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {formatZar(Math.round(limits.priceZar * 100))} / month ·{" "}
                      {limits.seats} seats
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={upgrade.isPending}
                    onClick={() => upgrade.mutate(tier)}
                    className="flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold"
                    style={{
                      backgroundColor: "var(--accent-green)",
                      color: "var(--bg-base)",
                      opacity: upgrade.isPending ? 0.6 : 1,
                    }}
                  >
                    {upgrade.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    Upgrade
                  </button>
                </div>
              );
            })}
          </div>
          {upgrade.error && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--state-error)" }} role="alert">
              {upgrade.error instanceof Error ? upgrade.error.message : "Upgrade failed."}
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
                    
