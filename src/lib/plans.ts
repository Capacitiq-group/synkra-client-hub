/**
 * SYNKRA Flow plan limits — SINGLE SOURCE OF TRUTH.
 *
 * These numbers are hardcoded on purpose. They are NOT editable through any UI
 * and must never be duplicated elsewhere in the codebase: always read them
 * through the getters below.
 *
 * No plan is unlimited. Every tier is usage-limited.
 */

export type PlanTier = "free" | "basic" | "pro";

export interface PlanLimits {
  /** Machine key for the tier. */
  tier: PlanTier;
  /** Customer-facing plan name. */
  name: string;
  /** Monthly price in ZAR (rand, not cents). */
  priceZar: number;
  workspaces: number;
  seats: number;
  /** Automation executions per month. */
  executions: number;
  activeWorkflows: number;
  draftWorkflows: number;
  maxWorkflowSteps: number;
  /** Storage allowance in GB. Usage is tracked in MB on the user record. */
  storageGb: number;
  /** Emails per month. */
  emails: number;
  /** Included AI operations per month (0 = add-on purchase required). */
  aiOps: number;
  /** Included SMS per month (0 = add-on purchase required). */
  sms: number;
  /** Included WhatsApp conversations per month (0 = add-on purchase required). */
  whatsapp: number;
  /** Included voice minutes per month (0 = add-on purchase required). */
  voiceMinutes: number;
  /**
   * Whether the tier may connect external platforms (integrations).
   * Free keeps every other free-tier capability; it just cannot connect any
   * external platform. There is NO cap on how many a paid tier may connect.
   */
  integrations: boolean;
  /**
   * Amount in ZAR knocked off priceZar for a verified student (see
   * student_verified on the user record). 0 for tiers with no discount
   * (free has nothing to discount). Verification itself — academic email
   * or admin-approved document — never happens here; this is only ever
   * the amount, applied via getEffectivePriceZar below.
   */
  studentDiscountZar: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    tier: "free",
    name: "Free Forever",
    priceZar: 0,
    workspaces: 1,
    seats: 1,
    executions: 500,
    activeWorkflows: 5,
    draftWorkflows: 10,
    maxWorkflowSteps: 10,
    storageGb: 1,
    emails: 300,
    aiOps: 0,
    sms: 0,
    whatsapp: 0,
    voiceMinutes: 0,
    integrations: false,
    studentDiscountZar: 0,
  },
  basic: {
    tier: "basic",
    name: "Basic",
    priceZar: 199,
    workspaces: 1,
    seats: 3,
    executions: 15000,
    activeWorkflows: 25,
    draftWorkflows: 50,
    maxWorkflowSteps: 25,
    storageGb: 10,
    emails: 2000,
    aiOps: 1000,
    sms: 50,
    whatsapp: 50,
    voiceMinutes: 15,
    integrations: true,
    studentDiscountZar: 50,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceZar: 399,
    workspaces: 1,
    seats: 10,
    executions: 35000,
    activeWorkflows: 100,
    draftWorkflows: 200,
    maxWorkflowSteps: 50,
    storageGb: 25,
    emails: 5000,
    aiOps: 1750,
    sms: 75,
    whatsapp: 75,
    voiceMinutes: 15,
    integrations: true,
    studentDiscountZar: 150,
  },
};

export const PLAN_ORDER: PlanTier[] = ["free", "basic", "pro"];

export const MB_PER_GB = 1024;

/** Normalises any stored/unknown tier value to a valid tier. Defaults to free. */
export function normalizeTier(tier: unknown): PlanTier {
  const value = typeof tier === "string" ? tier.trim().toLowerCase() : "";
  return (PLAN_ORDER as string[]).includes(value) ? (value as PlanTier) : "free";
}

export function getPlanLimits(tier: unknown): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier)];
}

export function getPlanName(tier: unknown): string {
  return getPlanLimits(tier).name;
}

export function getPlanPrice(tier: unknown): number {
  return getPlanLimits(tier).priceZar;
}

/**
 * The price actually charged: full priceZar, or priceZar minus
 * studentDiscountZar when the buyer is a verified student. Never goes
 * negative even if a future discount somehow exceeded the price.
 */
export function getEffectivePriceZar(tier: unknown, isStudentVerified: boolean): number {
  const plan = getPlanLimits(tier);
  if (!isStudentVerified) return plan.priceZar;
  return Math.max(0, plan.priceZar - plan.studentDiscountZar);
}

/** The next tier up, or null when already on the highest plan. */
export function getNextTier(tier: unknown): PlanTier | null {
  const index = PLAN_ORDER.indexOf(normalizeTier(tier));
  return PLAN_ORDER[index + 1] ?? null;
}

export function getExecutionLimit(tier: unknown): number {
  return getPlanLimits(tier).executions;
}

/** Active workflow limit (see getDraftWorkflowLimit for drafts). */
export function getWorkflowLimit(tier: unknown): number {
  return getPlanLimits(tier).activeWorkflows;
}

export function getDraftWorkflowLimit(tier: unknown): number {
  return getPlanLimits(tier).draftWorkflows;
}

/** Storage allowance in GB. */
export function getStorageLimit(tier: unknown): number {
  return getPlanLimits(tier).storageGb;
}

/** Storage allowance expressed in MB, matching `storage_used_mb`. */
export function getStorageLimitMb(tier: unknown): number {
  return getPlanLimits(tier).storageGb * MB_PER_GB;
}

export function getEmailLimit(tier: unknown): number {
  return getPlanLimits(tier).emails;
}

export function getAiOpsLimit(tier: unknown): number {
  return getPlanLimits(tier).aiOps;
}

export function getSmsLimit(tier: unknown): number {
  return getPlanLimits(tier).sms;
}

export function getWhatsappLimit(tier: unknown): number {
  return getPlanLimits(tier).whatsapp;
}

export function getVoiceLimit(tier: unknown): number {
  return getPlanLimits(tier).voiceMinutes;
}

/**
 * True when the tier may connect external platforms. Paid tiers only, and the
 * number of connected platforms is never limited.
 */
export function integrationsAllowed(tier: unknown): boolean {
  return getPlanLimits(tier).integrations;
}

/** One-line, reused everywhere package info is shown. */
export const INTEGRATIONS_PAID_PLAN_NOTE =
  "Integrations require a paid plan — Upgrade to connect.";

/** Package-info line for a tier: "Unlimited integrations" vs the paid-plan note. */
export function integrationsPlanLabel(tier: unknown): string {
  return integrationsAllowed(tier)
    ? "Unlimited integrations"
    : "No integrations (paid plans only)";
}

export function getSeatLimit(tier: unknown): number {
  return getPlanLimits(tier).seats;
}

export function getWorkspaceLimit(tier: unknown): number {
  return getPlanLimits(tier).workspaces;
}

export function getMaxWorkflowSteps(tier: unknown): number {
  return getPlanLimits(tier).maxWorkflowSteps;
}

/** Coerces a possibly missing/invalid numeric usage value to a safe number. */
export function safeUsage(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type UsageState = "ok" | "warning" | "reached" | "addon";

export interface UsageMetric {
  key: string;
  label: string;
  used: number;
  limit: number;
  /** Percentage 0-100+ (0 when the limit is 0). */
  percent: number;
  state: UsageState;
  /** Formatted "3,241 / 5,000" style string, unit-aware. */
  display: string;
  unit?: string;
}

export function usageState(used: number, limit: number): UsageState {
  if (limit <= 0) return "addon";
  const pct = (used / limit) * 100;
  if (pct >= 100) return "reached";
  if (pct >= 90) return "warning";
  return "ok";
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return (used / limit) * 100;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-ZA");
}

/** Renders MB as a friendly GB/MB string. */
export function formatStorage(mb: number): string {
  const safe = safeUsage(mb);
  if (safe >= MB_PER_GB) return `${(safe / MB_PER_GB).toFixed(safe % MB_PER_GB === 0 ? 0 : 1)} GB`;
  return `${Math.round(safe)} MB`;
}
