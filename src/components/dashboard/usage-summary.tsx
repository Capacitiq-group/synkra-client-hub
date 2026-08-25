import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { Shimmer } from "./primitives";
import { formatNumber, usagePercent, usageState } from "@/lib/plans";
import { ExecutionPackModal } from "@/components/settings/execution-pack-modal";
import { getExecutionCreditBalanceFn } from "@/lib/billing/execution-packs.functions";
import {
  EXECUTION_LIMIT_TITLE,
  emptyExecutionBalance,
  type ExecutionCreditBalance,
} from "@/lib/billing/execution-packs";

/** Compact executions-only usage widget for the dashboard home. */
export function UsageSummary() {
  const usage = usePlanUsage();
  const { user } = useAuth();
  const [packModal, setPackModal] = useState(false);

  const credit = useQuery<ExecutionCreditBalance>({
    queryKey: ["execution-credit-balance", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const token = pb.authStore.token;
      if (!token) throw new Error("Not authenticated");
      const result = (await getExecutionCreditBalanceFn({ data: { token } })) as unknown as
        | { ok: true; balance: ExecutionCreditBalance }
        | { ok: false; error: string; message: string };
      if (!result.ok) throw new Error(result.message);
      return result.balance;
    },
  });

  if (usage.isLoading) return <Shimmer height={92} />;
  if (usage.isError || !usage.data) return null;

  const { limits, executionsUsed } = usage.data;
  const percent = usagePercent(executionsUsed, limits.executions);
  const state = usageState(executionsUsed, limits.executions);
  const purchased = credit.data ?? emptyExecutionBalance();
  const color =
    state === "reached"
      ? "var(--state-error)"
      : state === "warning"
        ? "var(--state-warning)"
        : "var(--accent-green)";

  return (
    <section
      aria-label="Usage summary"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          Automation executions · {limits.name}
        </span>
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {formatNumber(executionsUsed)} / {formatNumber(limits.executions)}
        </span>
      </div>
      <div
        className="mt-3"
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: "var(--border-default)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={Math.round(Math.min(100, percent))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(percent > 0 ? 2 : 0, percent))}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: color,
            transition: "width 300ms ease",
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span style={{ fontSize: 13, color: state === "ok" ? "var(--text-muted)" : color }}>
          {state === "reached" ? (
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle size={13} aria-hidden="true" />
              {EXECUTION_LIMIT_TITLE}
            </span>
          ) : state === "warning" ? (
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle size={13} aria-hidden="true" />
              Approaching your monthly execution limit.
            </span>
          ) : (
            `${Math.round(percent)}% of this month's allowance used`
          )}
        </span>
        <Link
          to="/dashboard/settings"
          search={{ tab: "usage" }}
          className="synkra-focus rounded-sm"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}
        >
          View usage
        </Link>
      </div>

      {purchased.remaining > 0 && (
        <p className="mt-2" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>
            +{formatNumber(purchased.remaining)} purchased executions
          </span>{" "}
          available — these don't expire and are used after your monthly allowance.
        </p>
      )}

      {state === "reached" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPackModal(true)}
            className="synkra-focus inline-flex h-9 items-center rounded-lg px-3"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--bg-base)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Buy more executions
          </button>
          <Link
            to="/dashboard/settings"
            search={{ tab: "billing" }}
            className="synkra-focus inline-flex h-9 items-center rounded-lg px-3"
            style={{
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upgrade plan
          </Link>
        </div>
      )}

      {packModal && (
        <ExecutionPackModal
          onClose={() => {
            setPackModal(false);
            void credit.refetch();
          }}
        />
      )}
    </section>
  );
}
