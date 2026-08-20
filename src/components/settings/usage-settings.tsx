import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { getAddonBalancesFn } from "@/lib/billing/addons.functions";
import { startUpgradeFn } from "@/lib/billing/billing.functions";
import { AddonPurchaseModal, ComingSoonBadge } from "@/components/settings/addon-purchase-modal";
import { ADDON_CATALOG, type AddonKind } from "@/lib/billing/addons";
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
  onBuyAddOn,
  addonKind,
}: {
  label: string;
  used: number;
  limit: number;
  display: string;
  onUpgrade: () => void;
  canUpgrade: boolean;
  onBuyAddOn?: () => void;
  addonKind?: AddonKind;
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
          {onBuyAddOn &&
            addonKind &&
            (ADDON_CATALOG[addonKind].purchasable ? (
              <button
                type="button"
                onClick={onBuyAddOn}
                className="synkra-focus inline-flex items-center gap-1 rounded-sm"
                style={{ color: "var(--accent-green)", fontWeight: 600 }}
              >
                Buy more <ArrowUpRight size={13} aria-hidden="true" />
              </button>
            ) : (
              <ComingSoonBadge />
            ))}
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
  balance,
  onBuyAddOn,
  addonKind,
}: {
  label: string;
  included: number;
  unit: string;
  balance: number;
  onBuyAddOn: () => void;
  addonKind: AddonKind;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</span>
      <span className="flex flex-wrap items-center gap-3">
        {included > 0 ? (
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {formatNumber(included)} {unit} included this month
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Not included on your plan — available as a paid add-on
          </span>
        )}
        {balance > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}>
            +{formatNumber(balance)} {unit} purchased
          </span>
        )}
        {ADDON_CATALOG[addonKind].purchasable ? (
          <button
            type="button"
            onClick={onBuyAddOn}
            className="synkra-focus inline-flex items-center gap-1 rounded-sm"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}
          >
            Buy add-on <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        ) : (
          <ComingSoonBadge />
        )}
      </span>
    </div>
  );
}

export function UsageSettings() {
  const usage = usePlanUsage();
  const { user } = useAuth();
  const [addonModal, setAddonModal] = useState<AddonKind | null>(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const addonBalances = useQuery({
    queryKey: ["addon-balances", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const token = pb.authStore.token;
      if (!token) throw new Error("Not authenticated");
      const result = (await getAddonBalancesFn({ data: { token } })) as unknown as
        | { ok: true; balances: Array<{ kind: AddonKind; remaining: number; unit: string; label: string }> }
        | { ok: false; error: string; message: string };
      if (!result.ok) throw new Error(result.message);
      return result.balances;
    },
  });

  function balanceFor(kind: AddonKind): number {
    return addonBalances.data?.find((b) => b.kind === kind)?.remaining ?? 0;
  }

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

  /**
   * Real upgrade flow: the tier is sent to the existing server function, which
   * recomputes the price and returns a Paystack authorization URL. Same shape
   * and redirect as the add-on purchase and the public /checkout page.
   */
  const handleUpgrade = async () => {
    if (!nextTier || nextTier === "free") return;
    setUpgradeError(null);
    setUpgradeBusy(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        setUpgradeError("Your session has expired. Please sign in again.");
        return;
      }
      const result = (await startUpgradeFn({
        data: { token, tier: nextTier },
      })) as unknown as
        | { ok: true; authorizationUrl?: string }
        | { ok: false; error: string; message: string };
      if (!result.ok) {
        setUpgradeError(result.message);
        return;
      }
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      setUpgradeError("Could not start checkout — no payment link was returned.");
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : "Could not start the upgrade.");
    } finally {
      setUpgradeBusy(false);
    }
  };

  const handleBuyAddOn = (kind: AddonKind) => () => setAddonModal(kind);


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
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeBusy}
              className="synkra-focus inline-flex h-10 items-center gap-1.5 rounded-md px-4"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "var(--bg-base)",
                fontSize: 14,
                fontWeight: 600,
                opacity: upgradeBusy ? 0.6 : 1,
              }}
            >
              {upgradeBusy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Upgrade to {nextPlan.name} <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            {upgradeError && (
              <span role="alert" style={{ fontSize: 13, color: "var(--state-error)" }}>
                {upgradeError}
              </span>
            )}
          </div>
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
            onBuyAddOn={handleBuyAddOn("storage_gb")}
            addonKind="storage_gb"
          />
          {limits.aiOps > 0 ? (
            <UsageCard
              label="AI operations"
              used={aiOpsUsed}
              limit={limits.aiOps}
              display={`${formatNumber(aiOpsUsed)} / ${formatNumber(limits.aiOps)}`}
              onUpgrade={handleUpgrade}
              canUpgrade={canUpgrade}
              onBuyAddOn={handleBuyAddOn("ai_ops")}
              addonKind="ai_ops"
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
                  onClick={handleBuyAddOn("ai_ops")}
                  className="synkra-focus inline-flex items-center gap-1 rounded-sm"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}
                >
                  Buy AI add-on <ArrowUpRight size={13} aria-hidden="true" />
                  {balanceFor("ai_ops") > 0 && (
                    <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>
                      ({formatNumber(balanceFor("ai_ops"))} purchased)
                    </span>
                  )}
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
            balance={balanceFor("sms")}
            onBuyAddOn={handleBuyAddOn("sms")}
            addonKind="sms"
          />
          <AllowanceRow
            label="WhatsApp"
            included={limits.whatsapp}
            unit="conversations"
            balance={balanceFor("whatsapp")}
            onBuyAddOn={handleBuyAddOn("whatsapp")}
            addonKind="whatsapp"
          />
          <AllowanceRow
            label="Voice"
            included={limits.voiceMinutes}
            unit="minutes"
            balance={balanceFor("voice_minutes")}
            onBuyAddOn={handleBuyAddOn("voice_minutes")}
            addonKind="voice_minutes"
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

      {addonModal && (
        <AddonPurchaseModal
          kind={addonModal}
          onClose={() => {
            setAddonModal(null);
            addonBalances.refetch();
          }}
        />
      )}
    </div>
  );
}

