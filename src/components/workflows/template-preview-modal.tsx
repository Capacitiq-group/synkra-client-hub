import { Check, X } from "lucide-react";
import { definitionFor } from "@/lib/workflow/blocks";
import { describeBlock } from "@/lib/workflow/describe";
import type { PortalTemplate } from "@/hooks/useTemplates";

export function TemplatePreviewModal({
  template,
  onClose,
  onActivate,
  activated,
  pending,
}: {
  template: PortalTemplate;
  onClose: () => void;
  onActivate: () => void;
  activated: boolean;
  pending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${template.name} preview`}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 560,
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            {template.name}
          </h2>
          <button
            type="button"
            aria-label="Close preview"
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

        <h3
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 24,
          }}
        >
          What happens step by step
        </h3>
        <ol className="mt-3 space-y-3">
          {template.blocks.map((block, index) => {
            const definition = definitionFor(block as never);
            const Icon = definition?.icon;
            return (
              <li key={block.id ?? index} className="flex items-start gap-3">
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    {Icon && <Icon size={14} style={{ color: definition?.color }} aria-hidden="true" />}
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {block.label as string}
                    </span>
                  </span>
                  <span
                    className="block"
                    style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}
                  >
                    {describeBlock(block as never)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <h3
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 24,
          }}
        >
          What you need
        </h3>
        <ul className="mt-3 space-y-2">
          {template.requires_paid_api ? (
            <li style={{ fontSize: 14, color: "var(--state-warning)" }}>
              A connected Twilio account for WhatsApp or SMS sending
            </li>
          ) : (
            <li className="flex items-center gap-2" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              <Check size={15} style={{ color: "var(--state-success)" }} aria-hidden="true" />
              Email sending configured. This is already set up for you.
            </li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            className="synkra-focus rounded-md border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
              fontSize: 13,
              padding: "8px 16px",
            }}
          >
            Close
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onActivate}
            className="synkra-focus rounded-md font-semibold"
            style={{
              backgroundColor: activated ? "var(--bg-elevated)" : "var(--accent-green)",
              color: activated ? "var(--text-primary)" : "#0A0A0A",
              border: activated ? "1px solid var(--border-default)" : "none",
              fontSize: 13,
              padding: "8px 18px",
            }}
          >
            {activated ? "Open in builder" : "Activate this template"}
          </button>
        </div>
      </div>
    </div>
  );
}
