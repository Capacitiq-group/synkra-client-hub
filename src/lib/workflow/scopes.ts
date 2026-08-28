import type { IntegrationRecord } from "@/hooks/useIntegrations";
import type { BlockDefinition } from "./blocks";
import type { WorkflowBlock } from "./types";

/**
 * Scopes a block needs that the given integration record doesn't
 * currently have granted. Empty array means the block is good to go.
 * Checks the block instance's own `required_scopes` first (set by the
 * config panel for blocks like custom_api_call, where the requirement
 * depends on what the user picked) and falls back to the block
 * definition's static `requiredScopes` otherwise.
 */
export function missingScopes(
  definition: Pick<BlockDefinition, "requiredScopes"> | undefined,
  block: Pick<WorkflowBlock, "required_scopes"> | undefined,
  integration: IntegrationRecord | undefined,
): string[] {
  const required = block?.required_scopes ?? definition?.requiredScopes ?? [];
  if (!required.length) return [];
  const granted = new Set(integration?.scopes ?? []);
  return required.filter((scope) => !granted.has(scope));
}

/** Whether the integration this block needs is connected at all — the
 * coarser check that should gate the block *before* scope-level detail
 * matters. */
export function integrationConnected(
  requiresIntegration: string | undefined,
  integrations: Record<string, IntegrationRecord>,
): boolean {
  if (!requiresIntegration) return true;
  return integrations[requiresIntegration]?.status === "connected";
}
