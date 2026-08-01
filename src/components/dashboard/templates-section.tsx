import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Shimmer, SectionError, SectionHeading } from "./primitives";
import { activateTemplate, type PortalTemplate } from "@/hooks/useTemplates";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: 20,
  height: 160,
  width: 280,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  transition: "border-color 150ms ease, transform 150ms ease",
};

export function TemplatesSection({
  templates,
  isLoading,
  isError,
  onRetry,
  userId,
}: {
  templates: PortalTemplate[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  userId: string | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);

  const handleActivate = async (template: PortalTemplate) => {
    if (!userId) return;
    if (template.isActivated && template.workflowId) {
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: template.workflowId },
      });
      return;
    }
    setOptimistic((prev) => ({ ...prev, [template.template_id]: true }));
    setPending(template.template_id);
    try {
      const workflow = await activateTemplate(template, userId);
      toast.success("Workflow activated successfully");
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: workflow.id },
      });
    } catch {
      setOptimistic((prev) => ({ ...prev, [template.template_id]: false }));
      toast.error("Could not activate workflow. Please try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section aria-label="Start with a template">
      <SectionHeading
        title="Start with a template"
        action={
          <Link
            to="/dashboard/workflows"
            className="synkra-focus rounded-sm"
            style={{ fontSize: 13, color: "var(--accent-green)" }}
          >
            Browse all
          </Link>
        }
      />

      {isError ? (
        <div style={{ ...cardStyle, width: "100%", height: "auto" }}>
          <SectionError label="templates" onRetry={onRetry} />
        </div>
      ) : (
        <div className="synkra-scroll-x flex gap-4 overflow-x-auto" style={{ padding: 4 }}>
          {isLoading
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={cardStyle}>
                  <Shimmer height={11} width={80} />
                  <div className="mt-3">
                    <Shimmer height={16} width={190} />
                  </div>
                  <div className="mt-3">
                    <Shimmer height={13} />
                  </div>
                  <div className="mt-auto">
                    <Shimmer height={28} />
                  </div>
                </div>
              ))
            : templates.map((template) => {
                const activated = optimistic[template.template_id] ?? template.isActivated;
                return (
                  <article
                    key={template.id}
                    style={cardStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-green)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--accent-green)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {template.category}
                    </div>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        marginTop: 8,
                      }}
                    >
                      {template.name}
                    </h3>
                    <p
                      className="synkra-clamp-2"
                      style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}
                    >
                      {template.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {template.requires_paid_api ? "API key needed" : "No API required"}
                      </span>
                      <button
                        type="button"
                        disabled={pending === template.template_id}
                        onClick={() => handleActivate(template)}
                        className="synkra-focus inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors"
                        style={{
                          backgroundColor: activated
                            ? "var(--accent-green-subtle)"
                            : "var(--accent-green)",
                          color: activated ? "var(--accent-green)" : "var(--accent-green-foreground)",
                          fontSize: 13,
                          padding: "6px 14px",
                        }}
                      >
                        {activated && <Check size={13} aria-hidden="true" />}
                        {activated ? "Activated" : "Activate"}
                      </button>
                    </div>
                  </article>
                );
              })}
        </div>
      )}
    </section>
  );
}
