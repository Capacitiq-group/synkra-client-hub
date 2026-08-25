import { Sparkles, User } from "lucide-react";

export type OwnershipKind = "template" | "user";

/**
 * Ownership marker. The workflow area shows Synkra-provided templates and the
 * customer's own workflows in the same filtered result set, so every card must
 * state which it is — this is the single place that decides how that reads.
 */
export function OwnershipBadge({ kind }: { kind: OwnershipKind }) {
  const isTemplate = kind === "template";
  const Icon = isTemplate ? Sparkles : User;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        backgroundColor: isTemplate ? "var(--accent-green-subtle)" : "var(--bg-elevated)",
        border: `1px solid ${isTemplate ? "var(--accent-green-border)" : "var(--border-default)"}`,
        color: isTemplate ? "var(--accent-green)" : "var(--text-secondary)",
        borderRadius: "var(--radius-full)",
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} aria-hidden="true" />
      {isTemplate ? "Synkra template" : "Your workflow"}
    </span>
  );
}
