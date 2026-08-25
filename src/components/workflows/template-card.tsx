import { useState } from "react";
import { Clock, Info } from "lucide-react";
import { describeBlock } from "@/lib/workflow/describe";
import { OwnershipBadge } from "@/components/workflows/ownership-badge";
import type { PortalTemplate } from "@/hooks/useTemplates";
import type { WorkflowBlock } from "@/lib/workflow/types";

const dotColor = (kind: string) =>
  kind === "trigger"
    ? "var(--accent-green)"
    : kind === "logic"
      ? "var(--state-warning)"
      : "var(--state-info)";

export function TemplateCard({
  template,
  activated,
  pending,
  onActivate,
  onPreview,
}: {
  template: PortalTemplate;
  activated: boolean;
  pending: boolean;
  onActivate: () => void;
  onPreview: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const blocks = template.blocks as unknown as WorkflowBlock[];
  const visible = showAll ? blocks : blocks.slice(0, 4);
  const needsWhatsApp = template.integrations_required.some((i) => /whatsapp|sms|twilio/i.test(i));

  return (
    <article
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        transition: "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OwnershipBadge kind="template" />
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {template.category}
        </span>
      </div>
      <button
        type="button"
        onClick={onPreview}
        className="synkra-focus mt-2 self-start rounded-sm"
        style={{ fontSize: 13, color: "var(--accent-green)" }}
      >
        Preview
      </button>

      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 6 }}>
        {template.name}
      </h3>
      <p
        className="synkra-clamp-3"
        style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 8 }}
      >
        {template.description}
      </p>

      <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 16, paddingTop: 14 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          What this automation does
        </div>
        <ul className="mt-3 space-y-2">
          {visible.map((block, index) => (
            <li key={block.id ?? index} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  marginTop: 6,
                  flexShrink: 0,
                  backgroundColor: dotColor(block.type),
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {describeBlock(block)}
              </span>
            </li>
          ))}
        </ul>
        {blocks.length > 4 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="synkra-focus mt-2 rounded-sm"
            style={{ fontSize: 13, color: "var(--accent-green)" }}
          >
            Show more
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1.5" style={{ fontSize: 11 }}>
        <span style={{ color: "var(--text-muted)" }}>Needs:</span>
        {needsWhatsApp ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: "var(--state-warning)" }}
          >
            WhatsApp
            <span title="Available when messaging is connected">
              <Info size={12} aria-hidden="true" />
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--state-success)" }}>Email only</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className="flex items-center gap-1.5"
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          <Clock size={12} aria-hidden="true" />
          Takes about 2 minutes to activate
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={onActivate}
          className="synkra-focus rounded-md font-semibold"
          style={{
            backgroundColor: activated ? "var(--bg-elevated)" : "var(--accent-green)",
            color: activated ? "var(--text-primary)" : "#0A0A0A",
            border: activated ? "1px solid var(--border-default)" : "1px solid transparent",
            fontSize: 13,
            padding: "8px 18px",
            whiteSpace: "nowrap",
          }}
        >
          {activated ? "Open in builder" : "Activate"}
        </button>
      </div>
    </article>
  );
}
