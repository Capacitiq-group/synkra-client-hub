/**
 * Billing configuration (client-safe, pure).
 *
 * Prices are NEVER defined here. They come from `@/lib/plans` — the single
 * source of truth — and are only converted to the minor unit Paystack expects.
 */
import { PLAN_LIMITS, getPlanLimits, normalizeTier, type PlanTier } from "@/lib/plans";

/** Tiers a customer can actually pay for. Free is activated without payment. */
export const PURCHASABLE_TIERS = ["basic", "pro"] as const;
export type PurchasableTier = (typeof PURCHASABLE_TIERS)[number];

export const CURRENCY = "ZAR";
export const PROVIDER = "paystack";

export function isPurchasableTier(value: unknown): value is PurchasableTier {
  return (PURCHASABLE_TIERS as readonly string[]).includes(String(value));
}

/** Plan price in cents, derived from plans.ts. */
export function priceCents(tier: unknown): number {
  return Math.round(getPlanLimits(tier).priceZar * 100);
}

export function formatZar(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export interface PlanOption {
  tier: PlanTier;
  name: string;
  priceZar: number;
  priceCents: number;
  purchasable: boolean;
  highlights: string[];
}

/** The plan cards shown on the checkout page, built from plans.ts only. */
export function planOptions(): PlanOption[] {
  return (Object.keys(PLAN_LIMITS) as PlanTier[]).map((tier) => {
    const p = PLAN_LIMITS[tier];
    return {
      tier,
      name: p.name,
      priceZar: p.priceZar,
      priceCents: priceCents(tier),
      purchasable: isPurchasableTier(tier),
      highlights: [
        `${p.executions.toLocaleString("en-ZA")} executions / month`,
        `${p.activeWorkflows} active workflows`,
        `${p.seats} ${p.seats === 1 ? "seat" : "seats"}`,
        `${p.emails.toLocaleString("en-ZA")} emails / month`,
        `${p.storageGb} GB storage`,
      ],
    };
  });
}

export function tierName(tier: unknown): string {
  return getPlanLimits(normalizeTier(tier)).name;
}
