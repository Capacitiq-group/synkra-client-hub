// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Add-on purchases (server only). Balances, lots, and consumption now live in
 * `./addon-ledger.server` — this file is only checkout + Paystack settlement.
 *
 * The browser never sends a price: it names a fixed pack id from
 * `./addon-packs`, and the charge/units are recomputed here from that catalog
 * — never trusted from the request. Settlement is idempotent twice over: the
 * unique index on `addon_purchases.reference` gates this file's own re-entry,
 * and `grantAddonLot`'s own idempotency-on-reference check means even a
 * duplicate call from here can never grant a second lot for the same payment.
 */
import { randomUUID } from "crypto";
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { initializeTransaction, paystackConfigured, verifyTransaction } from "./paystack.server";
import { BillingError } from "./billing.server";
import { CURRENCY, PROVIDER } from "./config";
import { getAddon, type AddonKind } from "./addons";
import { getAddonPack, addonPackPriceCents, isAddonPackId } from "./addon-packs";
import { grantAddonLot } from "./addon-ledger.server";

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
/* Purchase                                                            */
/* ------------------------------------------------------------------ */

export interface AddonCheckoutResult {
  ok: true;
  reference: string;
  kind: AddonKind;
  packId: string;
  units: number;
  amountCents: number;
  authorizationUrl: string;
}

export async function createAddonCheckout(input: {
  userId: string;
  packId: unknown;
}): Promise<AddonCheckoutResult> {
  if (!isAddonPackId(input.packId)) {
    throw new BillingError("addon_unavailable", "That add-on pack no longer exists.");
  }
  // Authoritative on all three counts: which pack this is, how many units it
  // grants, and what it costs. getAddonPack() throws for anything not on the
  // published list, so a crafted packId can never reach a price at all, let
  // alone a forged one.
  const pack = getAddonPack(input.packId);
  const product = getAddon(pack.kind);
  if (!product.purchasable) {
    throw new BillingError("addon_unavailable", "This add-on isn't available yet.");
  }
  const amountCents = addonPackPriceCents(pack.id);

  if (!paystackConfigured()) {
    throw new BillingError("not_configured", "Card payments are not available right now.");
  }

  const pb = await adminClient();
  const user = asRecord(await pb.collection("users").getOne(input.userId));
  const email = str(user, "email");
  if (!email) throw new BillingError("invalid_email", "Your account has no email address.");

  const reference = `${ADDON_REFERENCE_PREFIX}-${pack.kind.toUpperCase()}-${randomUUID()}`;
  const purchase = await pb.collection("addon_purchases").create({
    user_id: input.userId,
    kind: pack.kind,
    pack_id: pack.id,
    units: pack.units,
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
      metadata: { user_id: input.userId, addon: pack.kind, pack_id: pack.id, units: pack.units },
    });
    await pb.collection("addon_purchases").update(purchase.id, {
      authorization_url: init.authorization_url,
      access_code: init.access_code,
    });
    return {
      ok: true,
      reference,
      kind: pack.kind,
      packId: pack.id,
      units: pack.units,
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

  // Recompute from pack_id — the authoritative source — rather than trusting
  // whatever units/amount_cents this row already has stored, consistent with
  // "the browser never sends a price" applying to every stage, not just the
  // very first checkout call. Falls back to the row's own legacy fields for
  // any purchase created before this pack_id migration shipped, so an
  // in-flight purchase from the old model doesn't fail to settle.
  const packId = str(purchase, "pack_id");
  let kind: AddonKind;
  let units: number;
  let expected: number;
  if (packId) {
    const pack = getAddonPack(packId);
    kind = pack.kind;
    units = pack.units;
    expected = addonPackPriceCents(packId);
  } else {
    kind = getAddon(str(purchase, "kind")).kind;
    units = num(purchase, "units");
    expected = num(purchase, "amount_cents");
  }

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

  if (expected > 0 && verification.amount !== expected) {
    await pb.collection("addon_purchases").update(str(purchase, "id"), {
      status: "failed",
      error_message: `Amount mismatch: charged ${verification.amount}, expected ${expected}.`,
    });
    return { ok: false, status: "failed", alreadySettled: false, kind, units };
  }

  // Re-read immediately before flipping the row: if a concurrent webhook /
  // return-page settlement already marked it paid, stop here rather than
  // granting the units a second time.
  const fresh = await findOne(pb, "addon_purchases", "reference = {:reference}", { reference });
  if (fresh && str(fresh, "status") === "paid") {
    return { ok: true, status: "paid", alreadySettled: true, kind, units };
  }

  await pb.collection("addon_purchases").update(str(purchase, "id"), {
    status: "paid",
    paid_at: verification.paid_at ?? new Date().toISOString(),
    provider_transaction_id: String(verification.id ?? ""),
    error_message: "",
  });

  // grantAddonLot is itself idempotent on `reference` (a proper existence
  // check before creating the lot), so a replay from a racing webhook +
  // return-page settlement can never grant a second lot for the same payment.
  await grantAddonLot({
    userId: str(purchase, "user_id"),
    kind,
    packId,
    units,
    priceCents: expected,
    reference,
    purchasedAt: verification.paid_at ?? new Date().toISOString(),
  });

  // Confirmation email. The credits are already granted at this point, so a
  // delivery failure is logged and swallowed — it must never fail settlement.
  try {
    const buyer = asRecord(await pb.collection("users").getOne(str(purchase, "user_id")));
    const email = str(buyer, "email");
    if (email) {
      const product = getAddon(kind);
      const { sendEmail, addonPurchaseEmail } = await import("./email.server");
      const sent = await sendEmail({
        to: email,
        ...addonPurchaseEmail(product.label, units, product.unit),
      });
      if (!sent.ok) console.error("[addons] confirmation email failed:", sent.error);
    }
  } catch (err) {
    console.error("[addons] confirmation email failed:", err);
  }

  return { ok: true, status: "paid", alreadySettled: false, kind, units };
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

/**
 * True when `reference` belongs to `userId`. Used before any add-on status is
 * disclosed, so one account can never probe another account's purchases.
 */
export async function assertAddonPurchaseOwner(
  reference: string,
  userId: string,
): Promise<boolean> {
  const pb = await adminClient();
  const purchase = await findOne(pb, "addon_purchases", "reference = {:reference}", { reference });
  return Boolean(purchase && str(purchase, "user_id") === userId);
}

export interface AddonPurchaseHistoryEntry {
  id: string;
  reference: string;
  kind: AddonKind;
  packId: string;
  units: number;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string;
}

/** Every add-on purchase attempt for this account, newest first — pending, paid, and failed alike. */
export async function listAddonPurchases(
  userId: string,
  limit = 50,
): Promise<AddonPurchaseHistoryEntry[]> {
  const pb = await adminClient();
  const rows = await pb.collection("addon_purchases").getList(1, Math.min(limit, 200), {
    filter: pb.filter("user_id = {:userId}", { userId }),
    sort: "-created",
  });
  return rows.items.map((raw) => {
    const row = asRecord(raw);
    return {
      id: str(row, "id"),
      reference: str(row, "reference"),
      kind: str(row, "kind") as AddonKind,
      packId: str(row, "pack_id"),
      units: num(row, "units"),
      amountCents: num(row, "amount_cents"),
      currency: str(row, "currency") || "ZAR",
      status: str(row, "status"),
      createdAt: str(row, "created"),
      paidAt: str(row, "paid_at"),
    };
  });
}
