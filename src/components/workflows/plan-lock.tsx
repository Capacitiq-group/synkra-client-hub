import { Lock } from "lucide-react";
import { PAID_PLAN_HEADLINE, lockedReason, type PlanGatedItem } from "@/lib/workflow/plan-access";

/** Small "Paid plan" pill used on cards and rows. */
export function PaidPlanBadge({ locked }: { locked: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontSize: 11,
        fontWeight: 600,
        borderRadius: "var(--radius-full)",
        padding: "2px 8px",
        color: locked ? "var(--state-warning)" : "var(--text-muted)",
        border: `1px solid ${locked ? "var(--state-warning)" : "var(--border-default)"}`,
      }}
    >
      <Lock size={11} aria-hidden="true" />
      Paid plan
    </span>
  );
}

/**
 * Explicit "requires a paid plan" panel. The item stays fully visible — this
 * explains what the user would unlock and offers the upgrade path.
 */
export function PlanLockNotice({
  item,
  onUpgrade,
  compact = false,
}: {
  item: PlanGatedItem;
  onUpgrade: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="note"
      className="mt-4 flex flex-col gap-2"
      style={{
        border: "1px solid var(--state-warning)",
        backgroundColor: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        padding: compact ? 12 : 14,
      }}
    >
      <span
        className="inline-flex items-center gap-2"
        style={{ fontSize: 13, fontWeight: 700, color: "var(--state-warning)" }}
      >
        <Lock size={13} aria-hidden="true" />
        {PAID_PLAN_HEADLINE}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {lockedReason(item)} You can still preview everything it does.
      </span>
      <button
        type="button"
        onClick={onUpgrade}
        className="synkra-focus self-start rounded-md font-semibold"
        style={{
          backgroundColor: "var(--accent-green)",
          color: "#0A0A0A",
          fontSize: 13,
          padding: "7px 16px",
        }}
      >
        Upgrade plan
      </button>
    </div>
  );
}
