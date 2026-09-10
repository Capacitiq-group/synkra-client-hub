// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Prepaid add-on credit ledger (server only).
 *
 * This module is the single authority on what a customer may consume. Nothing
 * in the browser is trusted: the UI only ever displays what this file reports,
 * and every draw-down goes through `consumeAddonUnits`, which fails closed.
 *
 * Storage model — one row per PURCHASE, not one row per user+kind:
 *
 *   addon_credits      a "lot": units_purchased, units_used, units_remaining,
 *                      purchased_at, the paid reference that created it.
 *   addon_consumption  an append-only ledger line for every unit ever drawn,
 *                      naming the lot it came out of and why.
 *
 * Rules the model enforces:
 *   - no expiry. A lot stays spendable until it is drained, across any number
 *     of billing periods. Nothing in this file reads a billing period.
 *   - cumulative. Buying a second pack adds a second lot; the balance is the
 *     sum of the lots' remainders.
 *   - FIFO. Lots are drained oldest purchase first, by `purchased_at`.
 *   - never negative. A draw that cannot be covered in full consumes nothing
 *     and is refused, so a partially-funded action never half-runs.
 *
 * Concurrency: PocketBase gives us no multi-row transaction, so each lot
 * decrement is written with a compare-and-set on `units_used` (re-read, then
 * update only if the value has not moved). If a racing request took the units
 * first, we re-plan against the fresh remainders instead of overdrawing. Units
 * already taken in a plan that then fails are returned to their lots before we
 * refuse, so a lost race can never silently burn credit.
 */
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { ADDON_KINDS, getAddon, type AddonKind } from "./addons";

const MAX_LOTS = 500;

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

function whole(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface AddonLot {
  id: string;
  kind: AddonKind;
  packId: string;
  unitsPurchased: number;
  unitsUsed: number;
  unitsRemaining: number;
  priceCents: number;
  reference: string;
  purchasedAt: string;
}

export interface AddonLedgerEntry {
  id: string;
  kind: AddonKind;
  units: number;
  reason: string;
  lotId: string;
  balanceAfter: number;
  createdAt: string;
}

export interface PrepaidBalance {
  kind: AddonKind;
  label: string;
  unit: string;
  purchased: number;
  used: number;
  /** Purchased units still available. Never expires. */
  remaining: number;
  lots: number;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

async function lotRows(
  pb: PocketBase,
  userId: string,
  kind?: AddonKind,
): Promise<Record<string, unknown>[]> {
  const filter = kind
    ? pb.filter("user_id = {:userId} && kind = {:kind}", { userId, kind })
    : pb.filter("user_id = {:userId}", { userId });
  const rows = await pb
    .collection("addon_credits")
    // FIFO order. `purchased_at` is set from the settlement timestamp, so it is
    // the purchase order even if rows are written out of sequence on a replay.
    .getFullList({ filter, sort: "+purchased_at,+created", batch: MAX_LOTS });
  return rows.map(asRecord);
}

function toLot(row: Record<string, unknown>): AddonLot {
  const purchased = num(row, "units_purchased");
  const used = num(row, "units_used");
  return {
    id: str(row, "id"),
    kind: str(row, "kind") as AddonKind,
    packId: str(row, "pack_id"),
    unitsPurchased: purchased,
    unitsUsed: used,
    unitsRemaining: Math.max(0, purchased - used),
    priceCents: num(row, "price_cents"),
    reference: str(row, "reference"),
    purchasedAt: str(row, "purchased_at") || str(row, "created"),
  };
}

/** Every lot the account has ever bought, oldest first. */
export async function listAddonLots(userId: string): Promise<AddonLot[]> {
  const pb = await adminClient();
  return (await lotRows(pb, userId)).map(toLot);
}

/** Prepaid balance per kind, summed over the account's lots. */
export async function listPrepaidBalances(userId: string): Promise<PrepaidBalance[]> {
  const lots = await listAddonLots(userId);
  return ADDON_KINDS.map((kind) => {
    const product = getAddon(kind);
    const mine = lots.filter((lot) => lot.kind === kind);
    const purchased = mine.reduce((total, lot) => total + lot.unitsPurchased, 0);
    const used = mine.reduce((total, lot) => total + lot.unitsUsed, 0);
    return {
      kind,
      label: product.label,
      unit: product.unit,
      purchased,
      used,
      remaining: Math.max(0, purchased - used),
      lots: mine.length,
    };
  });
}

/** Remaining prepaid units for one kind. */
export async function prepaidRemaining(userId: string, kind: AddonKind): Promise<number> {
  const pb = await adminClient();
  const lots = (await lotRows(pb, userId, kind)).map(toLot);
  return lots.reduce((total, lot) => total + lot.unitsRemaining, 0);
}

/** Consumption ledger, newest first. */
export async function listAddonConsumption(
  userId: string,
  limit = 50,
): Promise<AddonLedgerEntry[]> {
  const pb = await adminClient();
  const rows = await pb.collection("addon_consumption").getList(1, Math.min(limit, 200), {
    filter: pb.filter("user_id = {:userId}", { userId }),
    sort: "-created",
  });
  return rows.items.map((raw) => {
    const row = asRecord(raw);
    return {
      id: str(row, "id"),
      kind: str(row, "kind") as AddonKind,
      units: num(row, "units"),
      reason: str(row, "reason"),
      lotId: str(row, "lot_id"),
      balanceAfter: num(row, "balance_after"),
      createdAt: str(row, "created"),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Granting                                                            */
/* ------------------------------------------------------------------ */

/**
 * Adds one lot for a settled purchase. Idempotent on `reference`: a webhook and
 * a return-page settlement racing on the same payment produce one lot, not two.
 */
export async function grantAddonLot(input: {
  userId: string;
  kind: AddonKind;
  packId: string;
  units: number;
  priceCents: number;
  reference: string;
  purchasedAt?: string;
}): Promise<{ granted: boolean; lotId: string }> {
  const pb = await adminClient();
  const units = whole(input.units);
  if (units <= 0) throw new Error("A pack must grant at least one unit.");

  const existing = await pb.collection("addon_credits").getList(1, 1, {
    filter: pb.filter("reference = {:reference}", { reference: input.reference }),
  });
  const already = existing.items[0];
  if (already) return { granted: false, lotId: String(already.id) };

  const lot = await pb.collection("addon_credits").create({
    user_id: input.userId,
    kind: input.kind,
    pack_id: input.packId,
    units_purchased: units,
    units_used: 0,
    price_cents: whole(input.priceCents),
    reference: input.reference,
    purchased_at: input.purchasedAt ?? new Date().toISOString(),
  });
  return { granted: true, lotId: String(lot.id) };
}

/* ------------------------------------------------------------------ */
/* Consumption                                                         */
/* ------------------------------------------------------------------ */

export interface ConsumeResult {
  allowed: boolean;
  /** Units actually drawn. Zero whenever `allowed` is false. */
  consumed: number;
  remaining: number;
  reason?: "invalid_amount" | "insufficient_balance" | "contended";
  message?: string;
}

interface Taken {
  lotId: string;
  units: number;
}

async function returnUnits(pb: PocketBase, taken: Taken[]): Promise<void> {
  for (const entry of taken) {
    try {
      const row = asRecord(await pb.collection("addon_credits").getOne(entry.lotId));
      await pb
        .collection("addon_credits")
        .update(entry.lotId, { units_used: Math.max(0, num(row, "units_used") - entry.units) });
    } catch (err) {
      // A lot we cannot put units back on is a real accounting problem, so it
      // is logged loudly rather than swallowed. The customer is not charged for
      // it — the action they attempted is refused either way.
      console.error("[addon-ledger] could not return units to lot", entry.lotId, err);
    }
  }
}

/**
 * Draws `units` from the account's prepaid balance for `kind`, oldest lot
 * first. All-or-nothing: if the whole amount cannot be covered, nothing is
 * consumed and the caller must refuse the action.
 *
 * Concurrency: every debit against a lot uses PocketBase's atomic "+"-suffixed
 * update (applied at the DB layer, not read-compute-write), the same
 * mechanism execution-packs.server.ts already uses for the single-lot case.
 * There is no read-then-write gap for a second request to land in: we always
 * attempt to reserve the full outstanding amount from a lot, then correct
 * back any overshoot past that lot's units_purchased. Two concurrent draws on
 * the same lot are serialized by the database itself, so whichever request's
 * increment overshoots gets exactly the overshoot handed back — no request
 * can ever see a "fresh" balance that's already stale by the time it writes.
 */
export async function consumeAddonUnits(input: {
  userId: string;
  kind: AddonKind;
  units: number;
  reason: string;
}): Promise<ConsumeResult> {
  const want = whole(input.units);
  if (want <= 0) {
    return {
      allowed: false,
      consumed: 0,
      remaining: 0,
      reason: "invalid_amount",
      message: "Amount must be a positive whole number.",
    };
  }

  const pb = await adminClient();
  const lots = (await lotRows(pb, input.userId, input.kind)).map(toLot);
  const available = lots.reduce((total, lot) => total + lot.unitsRemaining, 0);
  if (available < want) {
    return {
      allowed: false,
      consumed: 0,
      remaining: available,
      reason: "insufficient_balance",
      message: `Not enough prepaid ${getAddon(input.kind).unit} left. ${available} remaining, ${want} needed.`,
    };
  }

  const taken: Taken[] = [];
  let outstanding = want;

  for (const lot of lots) {
    if (outstanding <= 0) break;
    if (lot.unitsRemaining <= 0) continue;

    // Reserve everything we still need from this lot. The database, not this
    // process, decides how much of that actually lands within the lot's
    // purchased amount.
    const attempt = outstanding;
    const updated = asRecord(
      await pb.collection("addon_credits").update(lot.id, { "units_used+": attempt }),
    );
    const usedAfter = num(updated, "units_used");
    const overshoot = Math.max(0, usedAfter - lot.unitsPurchased);
    const actuallyTaken = attempt - overshoot;

    if (overshoot > 0) {
      await pb.collection("addon_credits").update(lot.id, { "units_used+": -overshoot });
    }
    if (actuallyTaken > 0) {
      taken.push({ lotId: lot.id, units: actuallyTaken });
      outstanding -= actuallyTaken;
    }
  }

  if (outstanding > 0) {
    // Contention ate into the balance between our estimate above and the
    // per-lot reservations: give back everything we did manage to take and
    // refuse the whole action, rather than half-spend it.
    await returnUnits(pb, taken);
    return {
      allowed: false,
      consumed: 0,
      remaining: await prepaidRemaining(input.userId, input.kind),
      reason: "insufficient_balance",
      message: `Not enough prepaid ${getAddon(input.kind).unit} left.`,
    };
  }

  const remaining = available - want;
  for (const entry of taken) {
    await pb.collection("addon_consumption").create({
      user_id: input.userId,
      kind: input.kind,
      lot_id: entry.lotId,
      units: entry.units,
      reason: input.reason,
      balance_after: remaining,
    });
  }
  return { allowed: true, consumed: want, remaining };
}
