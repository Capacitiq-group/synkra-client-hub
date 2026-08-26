import { ChevronRight, Lock } from "lucide-react";
import { flowSteps } from "@/lib/workflow/template-summary";
import { requiresPaidPlan } from "@/lib/workflow/plan-access";
import type { PortalTemplate } from "@/hooks/useTemplates";
import type { WorkflowBlock } from "@/lib/workflow/types";

/**
 * Catalogue card. Deliberately answers three questions only:
 * what does it do, which apps does it involve, can I use it.
 * Everything else lives in the template detail dialog.
 */
export function TemplateCard({
  template,
  pending,
  locked = false,
  onUse,
  onOpenDetail,
}: {
  template: PortalTemplate;
  pending: boolean;
  locked?: boolean;
  onUse: () => void;
  onOpenDetail: () => void;
}) {
  const { steps, extra } = flowSteps(template.blocks as unknown as WorkflowBlock[]);
  const paid = requiresPaidPlan(template);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail();
        }
      }}
      aria-label={`${template.name} — open template details`}
      className="synkra-focus flex cursor-pointer flex-col"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        transition: "border-color 150ms ease, transform 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
        {template.name}
      </h3>
      <p
        className="synkra-clamp-2"
        style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}
      >
        {template.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Workflow steps">
        {steps.map((step, index) => (
          <span key={`${step}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight size={12} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
            )}
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-full)",
                padding: "3px 9px",
                whiteSpace: "nowrap",
              }}
            >
              {step}
            </span>
          </span>
        ))}
        {extra > 0 && (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>+{extra}</span>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {paid ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ fontSize: 11.5, color: locked ? "var(--state-warning)" : "var(--text-muted)" }}
          >
            <Lock size={11} aria-hidden="true" />
            Paid plan
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            onUse();
          }}
          className="synkra-focus rounded-md font-semibold"
          style={{
            backgroundColor: locked ? "var(--bg-elevated)" : "var(--accent-green)",
            color: locked ? "var(--text-primary)" : "#0A0A0A",
            border: locked ? "1px solid var(--border-default)" : "1px solid transparent",
            fontSize: 13,
            padding: "7px 16px",
            whiteSpace: "nowrap",
          }}
        >
          {locked ? "Upgrade to use" : "Use template"}
        </button>
      </div>
    </article>
  );
}
