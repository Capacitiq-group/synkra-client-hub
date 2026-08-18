// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Add-on purchases and credit balances (server only).
 *
 * The browser never sends a price: it names an add-on kind and a whole number
 * of packs, and the charge is recomputed here from `./addons`. Settlement is
 * idempotent — the unique index on `addon_purchases.reference` is the lock, so
 * the webhook and the return page can both settle the same reference without
 * ever granting credit twice.
 */
import { randomUUID } from "crypto";
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { initializeTransaction, paystackConfigured, verifyTransaction } from "./paystack.server";
import { BillingError } from "./billing.server";
import { CURRENCY, PROVIDER } from "./config";
import {
  ADDON_KINDS,
  addonPriceCents,
  emptyBalance,
  getAddon,
  normalizePacks,
  unitsForPacks,
  type AddonBalance,
  type AddonKind,
} from "./addons";

const ADDON_REFERENCE_PREFIX = "SYN-ADDON";

export function isAddonReference(reference: string): boolean {
  return reference.startsWith(`${ADDON_REFERENCE_PREFIX}-`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function str(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "");
}

function num(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function findOne(
  pb: PocketBase,
  collection: string,
  filter: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const rows = await pb.collection(collection).getList(1, 1, { filter: pb.filter(filter, params) });
  const first = rows.items[0];
  return first ? asRecord(first) : null;
}

function appUrl(): string {
  const raw = process.env["APP_URL"] || process.env["VITE_APP_URL"] || "http://localhost:8080";
  return raw.replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* Balances                                                            */
/* ------------------------------------------------------------------ */

export async function listAddonBalances(userId: string): Promise<AddonBalance[]> {
  const pb = await adminClient();
  const rows = await pb
    .collection("addon_credits")
    .getFullList({ filter: pb.filter("user_id = {:userId}", { userId }) });

  const byKind = new Map<string, Record<string, unknown>>();
  for (const raw of rows) {
    const row = asRecord(raw);
    byKind.set(str(row, "kind"), row);
  }

  return ADDON_KINDS.map((kind) => {
    const row = byKind.get(kind);
    if (!row) return emptyBalance(kind);
    const purchased = num(row, "units_purchased");
    const used = num(row, "units_used");
    const product = getAddon(kind);
    return {
      kind,
      label: product.label,
      unit: product.unit,
      purchased,
      used,
      remaining: Math.max(0, purchased - used),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Purchase                                                            */
/* ------------------------------------------------------------------ */

export interface AddonCheckoutResult {
  ok: true;
  reference: string;
  kind: AddonKind;
  packs: number;
  units: number;
  amountCents: number;
  authorizationUrl: string;
}

export async function createAddonCheckout(input: {
  userId: string;
  kind: unknown;
  packs: unknown;
}): Promise<AddonCheckoutResult> {
  const product = getAddon(input.kind);
  const packs = normalizePacks(product.kind, input.packs);
  const units = unitsForPacks(product.kind, packs);
  const amountCents = addonPriceCents(product.kind, packs);

  if (!paystackConfigured()) {
    throw new BillingError("not_configured", "Card payments are not available right now.");
  }

  const pb = await adminClient();
  const user = asRecord(await pb.collection("users").getOne(input.userId));
  const email = str(user, "email");
  if (!email) throw new BillingError("invalid_email", "Your account has no email address.");

  const reference = `${ADDON_REFERENCE_PREFIX}-${product.kind.toUpperCase()}-${randomUUID()}`;
  const purchase = await pb.collection("addon_purchases").create({
    user_id: input.userId,
    kind: product.kind,
    packs,
    units,
    amount_cents: amountCents,
    currency: CURRENCY,
    provider: PROVIDER,
    reference,
    status: "pending",
  });

  try {
    const init = await initializeTransaction({
      email,
      amountCents,
      reference,
      currency: CURRENCY,
      callbackUrl: `${appUrl()}/checkout/return?reference=${encodeURIComponent(reference)}`,
      metadata: { user_id: input.userId, addon: product.kind, packs, units },
    });
    await pb.collection("addon_purchases").update(purchase.id, {
      authorization_url: init.authorization_url,
      access_code: init.access_code,
    });
    return {
      ok: true,
      reference,
      kind: product.kind,
      packs,
      units,
      amountCents,
      authorizationUrl: init.authorization_url,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the payment.";
    await pb
      .collection("addon_purchases")
      .update(purchase.id, { status: "failed", error_message: message });
    throw new BillingError("provider_error", message);
  }
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export interface AddonSettleResult {
  ok: boolean;
  status: "paid" | "failed" | "pending" | "unknown_reference";
  alreadySettled: boolean;
  kind?: AddonKind;
  units?: number;
}

export async function settleAddonPurchase(
  reference: string,
  source: "webhook" | "return" | "manual",
): Promise<AddonSettleResult> {
  const pb = await adminClient();
  const purchase = await findOne(pb, "addon_purchases", "reference = {:reference}", { reference });
  if (!purchase) return { ok: false, status: "unknown_reference", alreadySettled: false };

  const kind = getAddon(str(purchase, "kind")).kind;
  const units = num(purchase, "units");

  if (str(purchase, "status") === "paid") {
    return { ok: true, status: "paid", alreadySettled: true, kind, units };
  }

  const verification = await verifyTransaction(reference);
  if (verification.status !== "success") {
    await pb.collection("addon_purchases").update(str(purchase, "id"), {
      status: verification.status === "abandoned" ? "pending" : "failed",
      error_message: `Paystack reported "${verification.status}".`,
    });
    return {
      ok: false,
      status: verification.status === "abandoned" ? "pending" : "failed",
      alreadySettled: false,
      kind,
      units,
    };
  }

  const expected = num(purchase, "amount_cents");
  if (expected > 0 && verification.amount !== expected) {
    await pb.collection("addon_purchases").update(str(purchase, "id"), {
      status: "failed",
      error_message: `Amount mismatch: charged ${verification.amount}, expected ${expected}.`,
    });
    return { ok: false, status: "failed", alreadySettled: false, kind, units };
  }

  // Flip the row to paid first: the status check above plus this write make a
  // concurrent webhook + return-page settlement grant the units only once.
  try {
    await pb.collection("addon_purchases").update(str(purchase, "id"), {
      status: "paid",
      paid_at: verification.paid_at ?? new Date().toISOString(),
      provider_transaction_id: String(verification.id ?? ""),
      error_message: "",
    });
  } catch {
    return { ok: true, status: "paid", alreadySettled: true, kind, units };
  }

  const fresh = await findOne(pb, "addon_purchases", "reference = {:reference}", { reference });
  if (fresh && str(fresh, "credited_reference") === reference) {
    return { ok: true, status: "paid", alreadySettled: true, kind, units };
  }

  await grantAddonUnits(pb, { userId: str(purchase, "user_id"), kind, units, reference, source });
  return { ok: true, status: "paid", alreadySettled: false, kind, units };
}

async function grantAddonUnits(
  pb: PocketBase,
  input: {
    userId: string;
    kind: AddonKind;
    units: number;
    reference: string;
    source: string;
  },
) {
  const product = getAddon(input.kind);
  const existing = await findOne(pb, "addon_credits", "user_id = {:userId} && kind = {:kind}", {
    userId: input.userId,
    kind: input.kind,
  });

  if (existing) {
    if (str(existing, "last_reference") === input.reference) return;
    await pb.collection("addon_credits").update(str(existing, "id"), {
      units_purchased: num(existing, "units_purchased") + input.units,
      last_reference: input.reference,
    });
  } else {
    await pb.collection("addon_credits").create({
      user_id: input.userId,
      kind: input.kind,
      units_purchased: input.units,
      units_used: 0,
      monthly: product.monthly,
      period_start: new Date().toISOString(),
      last_reference: input.reference,
    });
  }

  // Storage is the one add-on the enforcement path reads straight off the user
  // record, because the storage limit is compared against a live total.
  if (input.kind === "storage_gb") {
    const user = asRecord(await pb.collection("users").getOne(input.userId));
    await pb
      .collection("users")
      .update(input.userId, { addon_storage_gb: num(user, "addon_storage_gb") + input.units });
  }
}

/* ------------------------------------------------------------------ */
/* Consumption                                                         */
/* ------------------------------------------------------------------ */

/**
 * Spends up to `units` of purchased credit and returns how much was spent.
 * Callers use the result to decide whether an over-limit action may proceed.
 */
export async function consumeAddonCredit(
  userId: string,
  kind: AddonKind,
  units = 1,
): Promise<{ spent: number; remaining: number }> {
  if (units <= 0) return { spent: 0, remaining: 0 };
  const pb = await adminClient();
  const row = await findOne(pb, "addon_credits", "user_id = {:userId} && kind = {:kind}", {
    userId,
    kind,
  });
  if (!row) return { spent: 0, remaining: 0 };

  const remaining = Math.max(0, num(row, "units_purchased") - num(row, "units_used"));
  const spent = Math.min(remaining, units);
  if (spent > 0) {
    await pb
      .collection("addon_credits")
      .update(str(row, "id"), { units_used: num(row, "units_used") + spent });
  }
  return { spent, remaining: remaining - spent };
}

export interface AddonPurchaseStatus {
  found: boolean;
  status: string;
  kind: AddonKind | null;
  units: number;
  amountCents: number;
  activated: boolean;
}

export async function getAddonPurchaseStatus(reference: string): Promise<AddonPurchaseStatus> {
  const pb = await adminClient();
  const purchase = await findOne(pb, "addon_purchases", "reference = {:reference}", { reference });
  if (!purchase) {
    return { found: false, status: "unknown", kind: null, units: 0, amountCents: 0, activated: false };
  }
  const status = str(purchase, "status");
  return {
    found: true,
    status,
    kind: getAddon(str(purchase, "kind")).kind,
    units: num(purchase, "units"),
    amountCents: num(purchase, "amount_cents"),
    activated: status === "paid",
  };
}
