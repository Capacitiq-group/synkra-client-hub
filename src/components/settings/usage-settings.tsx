import { AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import {
  formatNumber,
  formatStorage,
  getNextTier,
  getPlanLimits,
  getStorageLimitMb,
  usagePercent,
  usageState,
  MB_PER_GB,
  type UsageState,
} from "@/lib/plans";

function stateColor(state: UsageState): string {
  if (state === "reached") return "var(--state-error)";
  if (state === "warning") return "var(--state-warning)";
  return "var(--accent-green)";
}

function UsageBar({ percent, state }: { percent: number; state: UsageState }) {
  return (
    <div
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
          backgroundColor: stateColor(state),
          transition: "width 300ms ease, background-color 200ms ease",
        }}
      />
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  display,
  onUpgrade,
  canUpgrade,
}: {
  label: string;
  used: number;
  limit: number;
  display: string;
  onUpgrade: () => void;
  canUpgrade: boolean;
}) {
  const state = usageState(used, limit);
  const percent = usagePercent(used, limit);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {Math.round(percent)}% used
        </span>
      </div>
      <div className="mt-3">
        <UsageBar percent={percent} state={state} />
      </div>
      <div className="mt-2" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        {display}
      </div>

      {state !== "ok" && (
        <div
          className="mt-3 flex flex-wrap items-center gap-3"
          style={{ fontSize: 13, color: stateColor(state) }}
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle size={14} aria-hidden="true" />
            {state === "reached"
              ? `You've reached your ${label.toLowerCase()} limit for this month.`
              : `You're approaching your ${label.toLowerCase()} limit.`}
          </span>
          {canUpgrade && (
            <button
              type="button"
              onClick={onUpgrade}
              className="synkra-focus inline-flex items-center gap-1 rounded-sm"
              style={{ color: "var(--accent-green)", fontWeight: 600 }}
            >
              Upgrade <ArrowUpRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AllowanceRow({
  label,
  included,
  unit,
  onBuyAddOn,
}: {
  label: string;
  included: number;
  unit: string;
  onBuyAddOn: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</span>
      {included > 0 ? (
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {formatNumber(included)} {unit} included this month
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-3">
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Not included on your plan — available as a paid add-on
          </span>
          <button
            type="button"
            onClick={onBuyAddOn}
            className="synkra-focus inline-flex items-center gap-1 rounded-sm"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}
          >
            Buy add-on <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </span>
      )}
    </div>
  );
}

export function UsageSettings() {
  const usage = usePlanUsage();

  if (usage.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Shimmer height={96} />
        <Shimmer height={120} />
        <Shimmer height={120} />
      </div>
    );
  }

  if (usage.isError || !usage.data) {
    return <SectionError label="your usage" onRetry={() => usage.refetch()} />;
  }

  const { tier, limits, executionsUsed, aiOpsUsed, storageUsedMb, emailsUsed } = usage.data;
  const nextTier = getNextTier(tier);
  const canUpgrade = nextTier !== null;
  const nextPlan = nextTier ? getPlanLimits(nextTier) : null;
  const storageLimitMb = getStorageLimitMb(tier);

  const handleUpgrade = () => {
    // Payments are not wired up in this iteration.
    window.alert(
      nextPlan
        ? `Upgrading to ${nextPlan.name} (R${nextPlan.priceZar}/month) will be available soon.`
        : "You are already on our highest plan.",
    );
  };

  const handleBuyAddOn = () => {
    window.alert("Add-on packs will be available to purchase soon.");
  };

  return (
    <div className="flex flex-col gap-8">
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Current plan</div>
          <div
            className="mt-1 flex items-center gap-2"
            style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}
          >
            <Sparkles size={18} style={{ color: "var(--accent-green)" }} aria-hidden="true" />
            {limits.name}
          </div>
          <div className="mt-1" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            R{limits.priceZar}/month · {limits.seats} seat{limits.seats === 1 ? "" : "s"} ·{" "}
            {limits.workspaces} workspace
          </div>
        </div>
        {canUpgrade && nextPlan && (
          <button
            type="button"
            onClick={handleUpgrade}
            className="synkra-focus inline-flex h-10 items-center gap-1.5 rounded-md px-4"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--bg-base)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Upgrade to {nextPlan.name} <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          This month's usage
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <UsageCard
            label="Automation executions"
            used={executionsUsed}
            limit={limits.executions}
            display={`${formatNumber(executionsUsed)} / ${formatNumber(limits.executions)}`}
            onUpgrade={handleUpgrade}
            canUpgrade={canUpgrade}
          />
          <UsageCard
            label="Email"
            used={emailsUsed}
            limit={limits.emails}
            display={`${formatNumber(emailsUsed)} / ${formatNumber(limits.emails)}`}
            onUpgrade={handleUpgrade}
            canUpgrade={canUpgrade}
          />
          <UsageCard
            label="Storage"
            used={storageUsedMb}
            limit={storageLimitMb}
            display={`${formatStorage(storageUsedMb)} / ${limits.storageGb} GB`}
            onUpgrade={handleUpgrade}
            canUpgrade={canUpgrade}
          />
          {limits.aiOps > 0 ? (
            <UsageCard
              label="AI operations"
              used={aiOpsUsed}
              limit={limits.aiOps}
              display={`${formatNumber(aiOpsUsed)} / ${formatNumber(limits.aiOps)}`}
              onUpgrade={handleUpgrade}
              canUpgrade={canUpgrade}
            />
          ) : (
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                AI operations
              </div>
              <p className="mt-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Your plan doesn't include AI operations. You can add them as a paid add-on, or
                upgrade for a monthly included allowance.
              </p>
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleBuyAddOn}
                  className="synkra-focus inline-flex items-center gap-1 rounded-sm"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}
                >
                  Buy AI add-on <ArrowUpRight size={13} aria-hidden="true" />
                </button>
                {canUpgrade && nextPlan && (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    className="synkra-focus inline-flex items-center gap-1 rounded-sm"
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}
                  >
                    Upgrade to {nextPlan.name}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          Included messaging allowance
        </h2>
        <div
          className="mt-4"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "4px 20px",
          }}
        >
          <AllowanceRow
            label="SMS"
            included={limits.sms}
            unit="messages"
            onBuyAddOn={handleBuyAddOn}
          />
          <AllowanceRow
            label="WhatsApp"
            included={limits.whatsapp}
            unit="conversations"
            onBuyAddOn={handleBuyAddOn}
          />
          <AllowanceRow
            label="Voice"
            included={limits.voiceMinutes}
            unit="minutes"
            onBuyAddOn={handleBuyAddOn}
          />
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          Plan allowances
        </h2>
        <div
          className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
          }}
        >
          {[
            { label: "Active workflows", value: formatNumber(limits.activeWorkflows) },
            { label: "Draft workflows", value: formatNumber(limits.draftWorkflows) },
            { label: "Steps per workflow", value: formatNumber(limits.maxWorkflowSteps) },
            { label: "Team seats", value: formatNumber(limits.seats) },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.label}</div>
              <div
                className="mt-1"
                style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Storage allowance: {limits.storageGb} GB ({formatNumber(limits.storageGb * MB_PER_GB)} MB).
        </p>
      </section>

      <div
        className="flex flex-wrap items-center justify-between gap-3"
        style={{
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
        }}
      >
        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Estimated additional usage this month
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>R0.00</span>
      </div>
    </div>
  );
}
