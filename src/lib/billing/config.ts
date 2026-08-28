/**
 * Billing configuration (client-safe, pure).
 *
 * Prices are NEVER defined here. They come from `@/lib/plans` — the single
 * source of truth — and are only converted to the minor unit Paystack expects.
 */
import {
  PLAN_LIMITS,
  getPlanLimits,
  getEffectivePriceZar,
  integrationsAllowed,
  normalizeTier,
  INTEGRATIONS_PAID_PLAN_NOTE,
  type PlanTier,
} from "@/lib/plans";

/** Tiers a customer can actually pay for. Free is activated without payment. */
export const PURCHASABLE_TIERS = ["basic", "pro"] as const;
export type PurchasableTier = (typeof PURCHASABLE_TIERS)[number];

export const CURRENCY = "ZAR";
export const PROVIDER = "paystack";

export function isPurchasableTier(value: unknown): value is PurchasableTier {
  return (PURCHASABLE_TIERS as readonly string[]).includes(String(value));
}

/**
 * Plan price in cents, derived from plans.ts. `isStudentVerified` is always
 * determined server-side (a .ac.za email at signup, or an existing account's
 * student_verified field) — never trust a boolean supplied by the browser.
 */
export function priceCents(tier: unknown, isStudentVerified = false): number {
  return Math.round(getEffectivePriceZar(tier, isStudentVerified) * 100);
}

/** Server-side-only heuristic for a brand-new signup with no account yet:
 * a South African academic email is sufficient on its own. An existing
 * user's actual student_verified field always takes precedence over this
 * once an account exists — see createCheckout in billing.server.ts. */
export function looksLikeAcademicEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(".ac.za");
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
  studentDiscountApplied: boolean;
  highlights: string[];
}

/** The plan cards shown on the checkout page, built from plans.ts only.
 * Pass an email to preview the student discount live as the buyer types —
 * this is a UI preview only; the actual charge is always recomputed
 * server-side in createCheckout, never trusted from here. */
export function planOptions(email?: string): PlanOption[] {
  const isStudentVerified = Boolean(email && looksLikeAcademicEmail(email));
  return (Object.keys(PLAN_LIMITS) as PlanTier[]).map((tier) => {
    const p = PLAN_LIMITS[tier];
    const effectivePriceZar = isStudentVerified
      ? Math.max(0, p.priceZar - p.studentDiscountZar)
      : p.priceZar;
    return {
      tier,
      name: p.name,
      priceZar: effectivePriceZar,
      priceCents: priceCents(tier, isStudentVerified),
      purchasable: isPurchasableTier(tier),
      studentDiscountApplied: isStudentVerified && p.studentDiscountZar > 0,
      highlights: [
        `${p.executions.toLocaleString("en-ZA")} executions / month`,
        `${p.activeWorkflows} active workflows`,
        `${p.seats} ${p.seats === 1 ? "seat" : "seats"}`,
        `${p.emails.toLocaleString("en-ZA")} emails / month`,
        `${p.storageGb} GB storage`,
        integrationsAllowed(tier) ? "Unlimited integrations" : INTEGRATIONS_PAID_PLAN_NOTE,
      ],
    };
  });
}

export function tierName(tier: unknown): string {
  return getPlanLimits(normalizeTier(tier)).name;
}
