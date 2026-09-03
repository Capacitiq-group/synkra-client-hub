/**
 * Add-on catalogue (client-safe, pure).
 *
 * Add-ons top up the metered allowances that plans include only partially
 * (see `@/lib/plans` for the included allowances). Unit prices live here and
 * nowhere else — the server always recomputes the charge from this file, the
 * browser never sends an amount.
 *
 * Prices are in ZAR rand per unit, exactly as published:
 *   AI operation        R0.10 each
 *   Email                R0.05 each (see note on the emails entry below - not yet confirmed as final)
 *   SMS                 R0.90 each
 *   WhatsApp            R0.50 per conversation
 *   Voice               R5.00 per minute
 *   Storage             R30.00 per GB / month
 */

export const ADDON_KINDS = ["ai_ops", "emails", "sms", "whatsapp", "voice_minutes", "storage_gb"] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];

export interface AddonProduct {
  kind: AddonKind;
  /** Customer-facing name. */
  label: string;
  /** Unit noun, singular form used in copy. */
  unit: string;
  /** Price per single unit, in ZAR. */
  unitPriceZar: number;
  /** Units in one pack — quantities are always bought in whole packs. */
  packSize: number;
  /** Maximum packs in a single purchase (abuse + card-fraud guard). */
  maxPacks: number;
  /** True when the credit is consumed monthly rather than carried over. */
  monthly: boolean;
  /**
   * True only when the underlying capability is actually integrated and the
   * add-on may be sold. Non-purchasable add-ons render as "Coming soon" and are
   * rejected server-side, so a crafted request cannot buy credit for a channel
   * the platform cannot yet deliver on.
   */
  purchasable: boolean;
  description: string;
}

export const ADDON_CATALOG: Record<AddonKind, AddonProduct> = {
  ai_ops: {
    kind: "ai_ops",
    label: "AI operations",
    unit: "operations",
    unitPriceZar: 0.1,
    packSize: 500,
    maxPacks: 20,
    monthly: false,
    purchasable: true,
    description: "Extra AI steps for summarising, classifying and generating content.",
  },
  // Added 29 Aug 2026 alongside fixing the underlying bug this addon
  // depends on: execute_send_email had no credit check at all before
  // this, so email sending was completely unmetered - no plan limit
  // was ever enforced and emails_used_this_month was never
  // incremented anywhere. Price/pack size below are a reasonable
  // starting point mirroring this file's existing pattern (a cheap,
  // Synkra-hosted channel gets a bigger pack at a lower unit price,
  // same logic as ai_ops vs. the pricier third-party channels below)
  // - not a confirmed final price. Confirm before this is treated as
  // publicly quoted pricing.
  emails: {
    kind: "emails",
    label: "Email",
    unit: "emails",
    unitPriceZar: 0.05,
    packSize: 1000,
    maxPacks: 20,
    monthly: false,
    purchasable: true,
    description: "Extra transactional emails sent by your workflows.",
  },
  sms: {
    kind: "sms",
    label: "SMS",
    unit: "messages",
    unitPriceZar: 0.9,
    packSize: 50,
    maxPacks: 20,
    monthly: false,
    purchasable: false,
    description: "Outbound SMS sent from your workflows.",
  },
  whatsapp: {
    kind: "whatsapp",
    label: "WhatsApp",
    unit: "conversations",
    unitPriceZar: 0.5,
    packSize: 100,
    maxPacks: 20,
    monthly: false,
    purchasable: false,
    description: "WhatsApp conversations initiated by your automations.",
  },
  voice_minutes: {
    kind: "voice_minutes",
    label: "Voice",
    unit: "minutes",
    unitPriceZar: 5,
    packSize: 10,
    maxPacks: 20,
    monthly: false,
    purchasable: false,
    description: "Voice call minutes used by voice-enabled workflows.",
  },
  storage_gb: {
    kind: "storage_gb",
    label: "Storage",
    unit: "GB",
    unitPriceZar: 30,
    packSize: 1,
    maxPacks: 50,
    monthly: true,
    purchasable: false,
    description: "Additional file storage, billed per GB for the current month.",
  },
};

export const ADDON_PRODUCTS: AddonProduct[] = ADDON_KINDS.map((k) => ADDON_CATALOG[k]);

export function isAddonKind(value: unknown): value is AddonKind {
  return (ADDON_KINDS as readonly string[]).includes(String(value));
}

export function getAddon(kind: unknown): AddonProduct {
  if (!isAddonKind(kind)) throw new Error("Unknown add-on.");
  return ADDON_CATALOG[kind];
}

/** True when this add-on may be bought today. */
export function isAddonPurchasable(kind: unknown): boolean {
  return isAddonKind(kind) && ADDON_CATALOG[kind].purchasable;
}

/** Copy shown wherever a not-yet-integrated add-on would otherwise be sold. */
export const ADDON_UNAVAILABLE_MESSAGE = "This add-on isn't available yet.";

/** Units granted by a whole number of packs. */
export function unitsForPacks(kind: AddonKind, packs: number): number {
  return getAddon(kind).packSize * normalizePacks(kind, packs);
}

/** Clamps a requested pack count to a whole number inside the allowed range. */
export function normalizePacks(kind: AddonKind, packs: unknown): number {
  const product = getAddon(kind);
  const n = Math.floor(Number(packs));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, product.maxPacks);
}

/** Authoritative price for a pack purchase, in cents. */
export function addonPriceCents(kind: AddonKind, packs: number): number {
  const product = getAddon(kind);
  const count = normalizePacks(kind, packs);
  return Math.round(product.unitPriceZar * product.packSize * count * 100);
}

export function addonPackPriceZar(kind: AddonKind): number {
  const product = getAddon(kind);
  return product.unitPriceZar * product.packSize;
}

/** Shape returned to the browser for every add-on balance. */
export interface AddonBalance {
  kind: AddonKind;
  label: string;
  unit: string;
  /** Units bought and not yet consumed. */
  remaining: number;
  purchased: number;
  used: number;
}

export function emptyBalance(kind: AddonKind): AddonBalance {
  const product = ADDON_CATALOG[kind];
  return { kind, label: product.label, unit: product.unit, remaining: 0, purchased: 0, used: 0 };
}

export function emptyBalances(): AddonBalance[] {
  return ADDON_KINDS.map(emptyBalance);
}
