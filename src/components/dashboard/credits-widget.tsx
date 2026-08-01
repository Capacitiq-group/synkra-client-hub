import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { ProgressBar, SectionHeading } from "./primitives";
import type { DashboardStats } from "@/hooks/useDashboardStats";

function CreditRow({ label, used, total }: { label: string; used: number; total: number }) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar used={used} total={total} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3" style={{ fontSize: 13 }}>
        <span style={{ color: "var(--text-muted)" }}>
          {remaining.toLocaleString("en-ZA")} remaining of {total.toLocaleString("en-ZA")}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{pct}% used</span>
      </div>
    </div>
  );
}

export function CreditsWidget({ stats }: { stats: DashboardStats }) {
  const [modalOpen, setModalOpen] = useState(false);

  const emailsOut = stats.emailCreditsTotal > 0 && stats.emailCreditsRemaining <= 0;
  const runsOut =
    stats.workflowCreditsTotal > 0 && stats.workflowCreditsUsed >= stats.workflowCreditsTotal;
  const exhaustedType = emailsOut ? "email" : runsOut ? "workflow run" : null;

  return (
    <section aria-label="Your free allowance">
      <SectionHeading
        title="Your free allowance"
        action={
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="synkra-focus rounded-sm"
            style={{ fontSize: 13, color: "var(--accent-green)" }}
          >
            What happens when it runs out
          </button>
        }
      />

      {exhaustedType && (
        <div
          className="mb-4 flex gap-3"
          style={{
            backgroundColor: "var(--state-error-bg)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
          }}
        >
          <AlertTriangle size={16} style={{ color: "var(--state-error)" }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              Your {exhaustedType} credits are used up.
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              This automation type is paused until September when paid plans launch. We will email
              you before then.
            </div>
          </div>
        </div>
      )}

      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-2"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
        }}
      >
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Emails</h3>
          <div className="mt-4">
            <CreditRow
              label="Emails"
              used={stats.emailCreditsUsed}
              total={stats.emailCreditsTotal}
            />
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Workflow runs
          </h3>
          <div className="mt-4">
            <CreditRow
              label="Workflow runs"
              used={stats.workflowCreditsUsed}
              total={stats.workflowCreditsTotal}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="When your credits run out"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 400,
              width: "100%",
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                When your credits run out
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
                className="synkra-focus rounded-sm"
              >
                <X size={18} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <div
              className="mt-4 flex flex-col gap-4"
              style={{ fontSize: 15, color: "var(--text-secondary)" }}
            >
              <p>
                Your automation pauses for that specific type. If your email credits run out, email
                automations pause. If your workflow run credits run out, all automations pause.
              </p>
              <p>
                Your other automations keep running normally until their own credits are used.
              </p>
              <p>
                In September 2026 Synkra launches paid plans with affordable top-ups. You will get
                an email before your trial ends with everything you need to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="synkra-focus mt-6 rounded-md font-semibold"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "var(--accent-green-foreground)",
                fontSize: 14,
                padding: "10px 18px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
