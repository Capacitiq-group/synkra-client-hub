/**
 * Billing configuration — shared, browser-safe values only.
 *
 * Plan prices are NOT defined here. `src/lib/plans.ts` remains the single
 * source of truth for plan definitions, prices and limits; this module only
 * adds billing-specific vocabulary (currency, states, sources) and the
 * centralised add-on rate card used by the future add-on purchase flow.
 *
 * Nothing in this file may contain a secret: it is imported by React code.
 */
import { normalizeTier, getPlanLimits, type PlanTier } from "@/lib/plans";

export const BILLING_CURRENCY = "ZAR" as const;
export const BILLING_INTERVAL = "monthly" as const;

/** Paystack works in the minor unit (cents for ZAR). */
export function zarToMinorUnit(zar: number): number {
  return Math.round(zar * 100);
}

export function formatZar(zar: number): string {
  return `R${zar.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Authoritative price for a plan, resolved from plans.ts. Never from the client. */
export function planPriceZar(tier: unknown): number {
  return getPlanLimits(normalizeTier(tier)).priceZar;
}

export function isPaidPlan(tier: unknown): boolean {
  return planPriceZar(tier) > 0;
}

export type CheckoutStatus = "pending" | "completed" | "failed" | "cancelled" | "expired";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded" | "reversed";
export type SubscriptionStatus = "pending" | "active" | "cancelled" | "expired" | "past_due";

/** Attribution only — never an authorisation mechanism. */
export const CHECKOUT_SOURCES = ["client_hub", "website", "other"] as const;
export type CheckoutSource = (typeof CHECKOUT_SOURCES)[number];

export function normalizeSource(value: unknown): CheckoutSource {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (CHECKOUT_SOURCES as readonly string[]).includes(v) ? (v as CheckoutSource) : "other";
}

/** Pending checkouts older than this are treated as expired (never deleted). */
export const CHECKOUT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Magic sign-in links are single use and short lived. */
export const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;

/**
 * Add-on rate card. Centralised here so no UI component ever hardcodes a rate.
 * The add-on shop itself is intentionally NOT implemented yet — these rates
 * exist so the future purchase flow reuses the same billing pipeline.
 */
export interface AddonRate {
  key: string;
  label: string;
  unit: string;
  priceZar: number;
}

export const ADDON_RATES: Record<string, AddonRate> = {
  ai_ops: { key: "ai_ops", label: "AI operations", unit: "operation", priceZar: 0.1 },
  sms: { key: "sms", label: "SMS", unit: "message", priceZar: 0.9 },
  whatsapp: { key: "whatsapp", label: "WhatsApp", unit: "conversation", priceZar: 0.5 },
  voice: { key: "voice", label: "Voice", unit: "minute", priceZar: 5 },
  storage: { key: "storage", label: "Extra storage", unit: "GB / month", priceZar: 30 },
};

export interface BillingPlanOption {
  tier: PlanTier;
  name: string;
  priceZar: number;
  priceLabel: string;
  paid: boolean;
}

export function billingPlanOptions(): BillingPlanOption[] {
  return (["free", "basic", "pro"] as PlanTier[]).map((tier) => {
    const limits = getPlanLimits(tier);
    return {
      tier,
      name: limits.name,
      priceZar: limits.priceZar,
      priceLabel: limits.priceZar === 0 ? "R0" : `${formatZar(limits.priceZar)}/month`,
      paid: limits.priceZar > 0,
    };
  });
}
