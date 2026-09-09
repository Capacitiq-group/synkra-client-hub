/**
 * Prepaid add-on packs (client-safe, pure).
 *
 * Add-on credit is sold as fixed-price prepaid packs, never as an arbitrary
 * quantity the browser picks. The browser names a pack id; the server looks the
 * pack up here and recomputes both the charge and the units granted, so a
 * crafted request cannot buy 100,000 emails for R1.
 *
 * Published prices — do not alter without a pricing decision:
 *
 *   AI operations   R0.10 per operation
 *     R50    →    500 ops
 *     R100   →  1,000 ops
 *     R250   →  2,500 ops
 *     R500   →  5,000 ops
 *     R1,000 → 10,000 ops
 *
 *   Email           R0.01 per email
 *     R50    →   5,000 emails
 *     R100   →  10,000 emails
 *     R250   →  25,000 emails
 *     R500   →  50,000 emails
 *     R1,000 → 100,000 emails
 *
 *   Extra storage   R30 per GB / month
 *     Sold in prepaid GB-months. The smallest pack clears the R50 floor that
 *     applies to every add-on pack, so 1 GB on its own is not a pack:
 *     R60 → 2 GB-months, R150 → 5, R300 → 10, R600 → 20, R1,500 → 50.
 *
 * Every pack bought here is a non-expiring balance. Packs are cumulative, and
 * consumption is First-In-First-Out across purchases — see
 * `./addon-ledger.server` (TypeScript) and `services/ai_credits.py` (core),
 * which are the only two places credit is ever drawn down.
 */

import type { AddonKind } from "./addons";

/** The smallest amount any prepaid pack may be sold for, in rand. */
export const MIN_PACK_PRICE_ZAR = 50;

export interface AddonPack {
  /** Stable id stored on the purchase and on every credit lot it creates. */
  id: string;
  kind: AddonKind;
  /** Units granted by this pack. GB-months for storage. */
  units: number;
  /** Fixed pack price in ZAR rand. */
  priceZar: number;
}

export const AI_OPS_PACKS: AddonPack[] = [
  { id: "ai_ops_50", kind: "ai_ops", units: 500, priceZar: 50 },
  { id: "ai_ops_100", kind: "ai_ops", units: 1000, priceZar: 100 },
  { id: "ai_ops_250", kind: "ai_ops", units: 2500, priceZar: 250 },
  { id: "ai_ops_500", kind: "ai_ops", units: 5000, priceZar: 500 },
  { id: "ai_ops_1000", kind: "ai_ops", units: 10000, priceZar: 1000 },
];

export const EMAIL_PACKS: AddonPack[] = [
  { id: "emails_50", kind: "emails", units: 5000, priceZar: 50 },
  { id: "emails_100", kind: "emails", units: 10000, priceZar: 100 },
  { id: "emails_250", kind: "emails", units: 25000, priceZar: 250 },
  { id: "emails_500", kind: "emails", units: 50000, priceZar: 500 },
  { id: "emails_1000", kind: "emails", units: 100000, priceZar: 1000 },
];

export const STORAGE_PACKS: AddonPack[] = [
  { id: "storage_gb_2", kind: "storage_gb", units: 2, priceZar: 60 },
  { id: "storage_gb_5", kind: "storage_gb", units: 5, priceZar: 150 },
  { id: "storage_gb_10", kind: "storage_gb", units: 10, priceZar: 300 },
  { id: "storage_gb_20", kind: "storage_gb", units: 20, priceZar: 600 },
  { id: "storage_gb_50", kind: "storage_gb", units: 50, priceZar: 1500 },
];

export const ADDON_PACKS: AddonPack[] = [...AI_OPS_PACKS, ...EMAIL_PACKS, ...STORAGE_PACKS];

const BY_ID = new Map<string, AddonPack>(ADDON_PACKS.map((pack) => [pack.id, pack]));

/** Kinds that can actually be bought as a prepaid pack today. */
export const PREPAID_KINDS: AddonKind[] = ["ai_ops", "emails", "storage_gb"];

export function packsForKind(kind: AddonKind): AddonPack[] {
  return ADDON_PACKS.filter((pack) => pack.kind === kind);
}

export function isAddonPackId(value: unknown): value is string {
  return typeof value === "string" && BY_ID.has(value);
}

/** Throws for anything that is not a published pack, so no price can be forged. */
export function getAddonPack(id: unknown): AddonPack {
  const pack = typeof id === "string" ? BY_ID.get(id) : undefined;
  if (!pack) throw new Error(`Unknown add-on pack: ${String(id)}`);
  if (pack.priceZar < MIN_PACK_PRICE_ZAR) {
    throw new Error(`Pack ${pack.id} is priced below the R${MIN_PACK_PRICE_ZAR} floor.`);
  }
  return pack;
}

/** Authoritative charge for one pack, in cents. */
export function addonPackPriceCents(id: unknown): number {
  return Math.round(getAddonPack(id).priceZar * 100);
}

/** Effective unit price, for display only. */
export function addonPackUnitPriceZar(id: unknown): number {
  const pack = getAddonPack(id);
  return pack.priceZar / pack.units;
}
