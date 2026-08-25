/**
 * Plan gating for workflow templates and workflows.
 *
 * A template "requires a paid plan" when either:
 *  - it is flagged `requires_paid_api` (needs a metered third-party API), or
 *  - it references at least one catalog integration whose `requiresPaidPlan`
 *    is true (free tier cannot connect ANY external platform — see
 *    `integrationsAllowed` in @/lib/plans).
 *
 * The list of paid platforms is never hardcoded here: it is derived from the
 * integration catalog intersected with the platforms the item actually uses,
 * the same way the platform filter works.
 */

import { INTEGRATIONS } from "@/lib/integrations/catalog";
import { integrationsAllowed } from "@/lib/plans";
import { itemPlatforms, type FilterableItem } from "@/lib/workflow/filters";

export interface PaidRequirement {
  key: string;
  name: string;
}

export interface PlanGatedItem extends FilterableItem {
  requires_paid_api?: boolean | undefined;
}

/** Catalog integrations this item uses that are paid-plan only. */
export function paidRequirements(item: PlanGatedItem): PaidRequirement[] {
  const keys = new Set(itemPlatforms(item));
  return INTEGRATIONS.filter(
    (definition) => definition.requiresPaidPlan && keys.has(definition.key),
  ).map((definition) => ({ key: definition.key, name: definition.name }));
}

/** True when this item can never run on a plan without integrations. */
export function requiresPaidPlan(item: PlanGatedItem): boolean {
  return Boolean(item.requires_paid_api) || paidRequirements(item).length > 0;
}

/** True when the item requires a paid plan and the given tier is not paid. */
export function isLockedForTier(item: PlanGatedItem, tier: unknown): boolean {
  return requiresPaidPlan(item) && !integrationsAllowed(tier);
}

/** Human-readable reason shown in the locked state. */
export function lockedReason(item: PlanGatedItem): string {
  const names = paidRequirements(item).map((r) => r.name);
  if (names.length > 0) {
    return `Needs ${names.join(", ")} — connecting external platforms is available on paid plans.`;
  }
  return "This automation uses a paid third-party API that is not included on the free plan.";
}

export const PAID_PLAN_HEADLINE = "This workflow requires a paid plan";
