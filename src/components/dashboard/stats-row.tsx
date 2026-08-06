import { Shimmer, ProgressBar, SectionError } from "./primitives";
import type { DashboardStats } from "@/hooks/useDashboardStats";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: 24,
  transition: "border-color 150ms ease",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={cardStyle}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
    >
      {children}
    </div>
  );
}

function BigNumber({ value, color }: { value: string; color?: string | undefined }) {
  return (
    <div
      style={{
        fontSize: 44,
        fontWeight: 800,
        color: color ?? "var(--text-primary)",
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>{children}</div>;
}

export function StatsRow({
  stats,
  isLoading,
  isError,
  onRetry,
  isPaid,
  nextBillingDate,
}: {
  stats?: DashboardStats;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isPaid: boolean;
  nextBillingDate?: string | null;
}) {
  if (isError) {
    return (
      <div style={cardStyle}>
        <SectionError label="your stats" onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={cardStyle}>
            <Shimmer height={44} width={90} />
            <div className="mt-3">
              <Shimmer height={13} width={120} />
            </div>
            <div className="mt-3">
              <Shimmer height={13} width={150} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const daysColor =
    stats.daysRemaining === null
      ? undefined
      : stats.daysRemaining <= 3
        ? "var(--state-error)"
        : stats.daysRemaining <= 7
          ? "var(--state-warning)"
          : undefined;

  const emailPctUsed =
    stats.emailCreditsTotal > 0 ? (stats.emailCreditsUsed / stats.emailCreditsTotal) * 100 : 0;
  const emailColor =
    emailPctUsed >= 90
      ? "var(--state-error)"
      : emailPctUsed >= 80
        ? "var(--state-warning)"
        : "var(--text-primary)";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <h3 className="sr-only">Active workflows</h3>
        <BigNumber value={String(stats.activeCount)} />
        <Label>Active workflows</Label>
        <div
          style={{
            fontSize: 13,
            marginTop: 6,
            color: stats.errorCount > 0 ? "var(--state-error)" : "var(--text-secondary)",
          }}
        >
          {stats.totalWorkflows === 0
            ? "Activate a template to get started."
            : stats.errorCount > 0
              ? `${stats.errorCount} need attention`
              : `${stats.pausedCount} paused, ${stats.errorCount} with errors`}
        </div>
      </Card>

      <Card>
        <h3 className="sr-only">Runs this month</h3>
        <BigNumber value={stats.runsThisMonth.toLocaleString("en-ZA")} />
        <Label>Runs this month</Label>
        <div style={{ marginTop: 10 }}>
          <ProgressBar used={stats.runsThisMonth} total={stats.runsLimit} />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          {stats.runsThisMonth.toLocaleString("en-ZA")} of {stats.runsLimit.toLocaleString("en-ZA")}{" "}
          used
        </div>
      </Card>

      <Card>
        <h3 className="sr-only">{isPaid ? "Next billing" : "Days remaining"}</h3>
        {isPaid ? (
          <>
            <BigNumber
              value={
                nextBillingDate
                  ? new Date(nextBillingDate).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Not set"
              }
            />
            <Label>Next billing</Label>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              Active plan
            </div>
          </>
        ) : (
          <>
            <BigNumber
              value={stats.daysRemaining === null ? "0" : String(stats.daysRemaining)}
              color={daysColor}
            />
            <Label>Days remaining</Label>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              Free trial
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3 className="sr-only">Emails remaining</h3>
        <BigNumber value={stats.emailCreditsRemaining.toLocaleString("en-ZA")} color={emailColor} />
        <Label>Emails remaining</Label>
        <div style={{ marginTop: 10 }}>
          <ProgressBar used={stats.emailCreditsUsed} total={stats.emailCreditsTotal} />
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          {stats.emailCreditsUsed.toLocaleString("en-ZA")} of{" "}
          {stats.emailCreditsTotal.toLocaleString("en-ZA")} used
        </div>
      </Card>
    </div>
  );
}
