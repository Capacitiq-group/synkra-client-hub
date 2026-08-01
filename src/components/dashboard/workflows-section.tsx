import { Link, useNavigate } from "@tanstack/react-router";
import { Clock, Zap } from "lucide-react";
import type { RecordModel } from "pocketbase";
import { Shimmer, StatusBadge, SectionError, SectionHeading } from "./primitives";
import { relativeTime } from "@/lib/utils/time";

export interface WorkflowRecord extends RecordModel {
  name: string;
  description?: string;
  status: string;
  last_run_at?: string;
  run_count?: number;
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
  transition: "border-color 150ms ease, transform 150ms ease",
};

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="synkra-focus rounded-md border transition-colors"
      style={{
        borderColor: "var(--border-default)",
        backgroundColor: "transparent",
        color: "var(--text-secondary)",
        fontSize: 13,
        padding: "6px 12px",
      }}
    >
      {children}
    </button>
  );
}

export function WorkflowsSection({
  workflows,
  isLoading,
  isError,
  onRetry,
}: {
  workflows: WorkflowRecord[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const hasWorkflows = workflows.length > 0;

  return (
    <section aria-label="Your workflows">
      <SectionHeading
        title={hasWorkflows || isLoading ? "Your workflows" : "Ready to activate"}
        action={
          <Link
            to="/dashboard/workflows"
            className="synkra-focus rounded-sm"
            style={{ fontSize: 13, color: "var(--accent-green)" }}
          >
            View all
          </Link>
        }
      />

      {isError ? (
        <div style={cardStyle}>
          <SectionError label="your workflows" onRetry={onRetry} />
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} style={cardStyle}>
              <Shimmer height={16} width={180} />
              <div className="mt-3">
                <Shimmer height={13} />
              </div>
              <div className="mt-4">
                <Shimmer height={12} width={220} />
              </div>
              <div className="mt-4">
                <Shimmer height={30} width={200} />
              </div>
            </div>
          ))}
        </div>
      ) : !hasWorkflows ? (
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
          Choose a template to run your first automation.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {workflows.slice(0, 4).map((workflow) => (
              <article
                key={workflow.id}
                style={cardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {workflow.name}
                  </h3>
                  <StatusBadge status={workflow.status} />
                </div>
                <p
                  className="truncate"
                  style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}
                >
                  {workflow.description || "No description yet."}
                </p>
                <div
                  className="mt-4 flex items-center justify-between gap-3"
                  style={{ fontSize: 12, color: "var(--text-muted)" }}
                >
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} aria-hidden="true" />
                    {workflow.last_run_at
                      ? `Last run: ${relativeTime(new Date(workflow.last_run_at))}`
                      : "Never run"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap size={12} aria-hidden="true" />
                    {workflow.run_count ?? 0} runs this month
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <GhostButton
                    onClick={() =>
                      navigate({
                        to: "/dashboard/workflows/builder/$workflowId",
                        params: { workflowId: workflow.id },
                      })
                    }
                  >
                    Edit
                  </GhostButton>
                  <GhostButton
                    onClick={() =>
                      navigate({ to: "/dashboard/activity", search: { workflow: workflow.id } })
                    }
                  >
                    View activity
                  </GhostButton>
                </div>
              </article>
            ))}
          </div>
          {workflows.length > 4 && (
            <div className="mt-4">
              <Link
                to="/dashboard/workflows"
                className="synkra-focus rounded-sm"
                style={{ fontSize: 13, color: "var(--accent-green)" }}
              >
                View all {workflows.length} workflows
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
