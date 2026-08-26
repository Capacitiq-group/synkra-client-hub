import { Check, ChevronRight, X } from "lucide-react";
import { definitionFor } from "@/lib/workflow/blocks";
import { describeBlock } from "@/lib/workflow/describe";
import { flowSteps } from "@/lib/workflow/template-summary";
import { PlanLockNotice } from "@/components/workflows/plan-lock";
import { itemPlatforms } from "@/lib/workflow/filters";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import type { PortalTemplate } from "@/hooks/useTemplates";
import type { WorkflowBlock } from "@/lib/workflow/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Focused detail view for one Synkra template. This is where the depth lives:
 * the catalogue card stays scannable, and everything a user needs before
 * committing is explained here, ending in a single primary action.
 */
export function TemplateDetailModal({
  template,
  onClose,
  onUse,
  pending,
  locked = false,
  onUpgrade,
}: {
  template: PortalTemplate;
  onClose: () => void;
  onUse: () => void;
  pending: boolean;
  locked?: boolean;
  onUpgrade: () => void;
}) {
  const blocks = template.blocks as unknown as WorkflowBlock[];
  const trigger = blocks.find((block) => block.type === "trigger");
  const actions = blocks.filter((block) => block.type !== "trigger");
  const { steps, extra } = flowSteps(blocks, 6);
  const apps = itemPlatforms(template).map(
    (key) => INTEGRATIONS.find((integration) => integration.key === key)?.name ?? key,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${template.name} details`}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 600,
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {template.category || "Uncategorised"}
            </span>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginTop: 4,
              }}
            >
              {template.name}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close template details"
            onClick={onClose}
            className="synkra-focus rounded-md"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.6 }}>
          {template.description}
        </p>

        <Section title="Workflow">
          <div className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, index) => (
              <span key={`${step}-${index}`} className="inline-flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    size={12}
                    aria-hidden="true"
                    style={{ color: "var(--text-muted)" }}
                  />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    backgroundColor: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-full)",
                    padding: "3px 10px",
                  }}
                >
                  {step}
                </span>
              </span>
            ))}
            {extra > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>+{extra}</span>}
          </div>
        </Section>

        {trigger && (
          <Section title="Trigger">
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{describeBlock(trigger)}</p>
          </Section>
        )}

        {actions.length > 0 && (
          <Section title="Actions">
            <ol className="space-y-3">
              {actions.map((block, index) => {
                const definition = definitionFor(block);
                const Icon = definition?.icon;
                return (
                  <li key={block.id ?? index} className="flex items-start gap-3">
                    <span
                      className="flex shrink-0 items-center justify-center"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "var(--bg-elevated)",
                        color: "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {Icon ? (
                        <Icon size={13} style={{ color: definition?.color }} aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block"
                        style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}
                      >
                        {block.label}
                      </span>
                      <span
                        className="block"
                        style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}
                      >
                        {describeBlock(block)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>
        )}

        {apps.length > 0 && (
          <Section title="Apps used">
            <div className="flex flex-wrap gap-2">
              {apps.map((app) => (
                <span
                  key={app}
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-full)",
                    padding: "3px 10px",
                  }}
                >
                  {app}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="Requirements">
          {template.requires_paid_api ? (
            <p style={{ fontSize: 14, color: "var(--state-warning)" }}>
              A connected messaging or platform account is needed before this workflow can run.
            </p>
          ) : (
            <p
              className="flex items-center gap-2"
              style={{ fontSize: 14, color: "var(--text-secondary)" }}
            >
              <Check size={15} style={{ color: "var(--state-success)" }} aria-hidden="true" />
              Email sending is already set up for you — nothing to connect.
            </p>
          )}
        </Section>

        {locked && <PlanLockNotice item={template} onUpgrade={onUpgrade} compact />}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {locked ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="synkra-focus rounded-md font-semibold"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "#0A0A0A",
                fontSize: 13,
                padding: "9px 20px",
              }}
            >
              Upgrade plan
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onUse}
              className="synkra-focus rounded-md font-semibold"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "#0A0A0A",
                fontSize: 13,
                padding: "9px 20px",
              }}
            >
              {pending ? "Opening builder…" : "Use template"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="synkra-focus rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 13,
              padding: "9px 18px",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
                           }
