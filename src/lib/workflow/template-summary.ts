/**
 * Compact "app chain" summary used by the template catalogue cards, the
 * template detail dialog and the user's workflow cards.
 *
 * The goal is one scannable line such as `Webhook -> Email` or
 * `Schedule -> AI -> Slack`, derived from the workflow blocks themselves so
 * new block types and integrations show up automatically.
 */

import { blockSubtype } from "./blocks";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import type { WorkflowBlock } from "./types";

/** Extra names for step labels that are not integration keys. */
const STEP_LABELS: Record<string, string> = {
  webhook: "Webhook",
  schedule: "Schedule",
  wait: "Wait",
  condition: "Condition",
  branch: "Branch",
  notification: "Notification",
  store_data: "Data",
  lookup_data: "Data",
  generate_pdf: "PDF",
};

function integrationLabel(token: string): string | null {
  const parts = token.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const definition of INTEGRATIONS) {
    const key = definition.key.toLowerCase();
    if (parts.includes(key) || token.toLowerCase() === key) return definition.name;
  }
  return null;
}

/** Short label for one block: the app it uses, otherwise a friendly step name. */
export function stepLabel(block: WorkflowBlock): string {
  const subtype = blockSubtype(block);
  return (
    integrationLabel(subtype) ??
    STEP_LABELS[subtype] ??
    (subtype
      ? subtype
          .split(/[^a-zA-Z0-9]+/)
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : block.label)
  );
}

/**
 * Deduplicated chain of step labels, capped at `max`. `extra` is how many
 * steps were left out so the caller can render a "+n".
 */
export function flowSteps(
  blocks: WorkflowBlock[] | undefined | null,
  max = 3,
): { steps: string[]; extra: number } {
  const labels: string[] = [];
  for (const block of blocks ?? []) {
    const label = stepLabel(block);
    if (!label) continue;
    if (labels[labels.length - 1] === label) continue;
    labels.push(label);
  }
  return { steps: labels.slice(0, max), extra: Math.max(0, labels.length - max) };
}
