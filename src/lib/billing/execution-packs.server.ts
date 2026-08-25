// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Execution top-up pack purchases and the standing execution credit balance
 * (server only).
 *
 * Mirrors `./addons.server` deliberately: the browser names a published pack id
 * and nothing else, the charge is recomputed here from `./execution-packs`, and
 * settlement is idempotent — the unique index on
 * `execution_pack_purchases.reference` plus `execution_credits.last_reference`
 * mean the webhook and the return page can both settle the same reference
 * without ever granting executions twice.
 *
 * Purchased executions do NOT expire with the billing month. Nothing in this
 * file ever resets `units_purchased`, and the monthly rollover in
 * `@/lib/usage/executions.server` only touches the users record counters.
 */
import { randomUUID } from "crypto";
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { initializeTransaction, paystackConfigured, verifyTransaction } from "./paystack.server";
import { BillingError } from "./billing.server";
import { CURRENCY, PROVIDER } from "./config";
import {
  EXECUTION_CREDIT_KIND,
  emptyExecutionBalance,
  executionPackPriceCents,
  getExecutionPack,
  type ExecutionCreditBalance,
  type ExecutionPackId,
} from "./execution-packs";

export const PURCHASES_COLLECTION = "execution_pack_purchases";
export const CREDITS_COLLECTION = "execution_credits";

const EXECUTION_REFERENCE_PREFIX = "SYN-EXECPACK";

/** True for references created by this module (and only by this module). */
export function isExecutionPackReference(reference: string): boolean {
  return reference.startsWith(`${EXECUTION_REFERENCE_PREFIX}-`);
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
/* Balance                                                             */
/* ------------------------------------------------------------------ */

export async function getExecutionCreditBalance(userId: string): Promise<ExecutionCreditBalance> {
  const pb = await adminClient();
  const row = await findOne(pb, CREDITS_COLLECTION, "user_id = {:userId}", { userId });
  if (!row) return emptyExecutionBalance();
  const purchased = num(row, "units_purchased");
  const used = num(row, "units_used");
  return { purchased, used, remaining: Math.max(0, purchased - used) };
}

/* ------------------------------------------------------------------ */
/* Purchase                                                            */
/* ------------------------------------------------------------------ */

export interface ExecutionPackCheckoutResult {
  ok: true;
  reference: string;
  packId: ExecutionPackId;
  executions: number;
  amountCents: number;
  authorizationUrl: string;
}

export async function createExecutionPackCheckout(input: {
  userId: string;
  packId: unknown;
}): Promise<ExecutionPackCheckoutResult> {
  const pack = getExecutionPack(input.packId);
  const amountCents = executionPackPriceCents(pack.id);

  if (!paystackConfigured()) {
    throw new BillingError("not_configured", "Card payments are not available right now.");
  }

  const pb = await adminClient();
  const user = asRecord(await pb.collection("users").getOne(input.userId));
  const email = str(user, "email");
  if (!email) throw new BillingError("invalid_email", "Your account has no email address.");

  const reference = `${EXECUTION_REFERENCE_PREFIX}-${pack.executions}-${randomUUID()}`;
  const purchase = await pb.collection(PURCHASES_COLLECTION).create({
    user_id: input.userId,
    kind: EXECUTION_CREDIT_KIND,
    pack_id: pack.id,
    units: pack.executions,
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
      metadata: {
        user_id: input.userId,
        execution_pack: pack.id,
        units: pack.executions,
      },
    });
    await pb.collection(PURCHASES_COLLECTION).update(purchase.id, {
      authorization_url: init.authorization_url,
      access_code: init.access_code,
    });
    return {
      ok: true,
      reference,
      packId: pack.id,
      executions: pack.executions,
      amountCents,
      authorizationUrl: init.authorization_url,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the payment.";
    await pb
      .collection(PURCHASES_COLLECTION)
      .update(purchase.id, { status: "failed", error_message: message });
    throw new BillingError("provider_error", message);
  }
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export interface ExecutionPackSettleResult {
  ok: boolean;
  status: "paid" | "failed" | "pending" | "unknown_reference";
  alreadySettled: boolean;
  units?: number;
}

export async function settleExecutionPackPurchase(
  reference: string,
  _source: "webhook" | "return" | "manual",
): Promise<ExecutionPackSettleResult> {
  const pb = await adminClient();
  const purchase = await findOne(pb, PURCHASES_COLLECTION, "reference = {:reference}", {
    reference,
  });
  if (!purchase) return { ok: false, status: "unknown_reference", alreadySettled: false };

  const units = num(purchase, "units");

  if (str(purchase, "status") === "paid") {
    return { ok: true, status: "paid", alreadySettled: true, units };
  }

  const verification = await verifyTransaction(reference);
  if (verification.status !== "success") {
    await pb.collection(PURCHASES_COLLECTION).update(str(purchase, "id"), {
      status: verification.status === "abandoned" ? "pending" : "failed",
      error_message: `Paystack reported "${verification.status}".`,
    });
    return {
      ok: false,
      status: verification.status === "abandoned" ? "pending" : "failed",
      alreadySettled: false,
      units,
    };
  }

  const expected = num(purchase, "amount_cents");
  if (expected > 0 && verification.amount !== expected) {
    await pb.collection(PURCHASES_COLLECTION).update(str(purchase, "id"), {
      status: "failed",
      error_message: `Amount mismatch: charged ${verification.amount}, expected ${expected}.`,
    });
    return { ok: false, status: "failed", alreadySettled: false, units };
  }

  // Re-read immediately before flipping the row: a concurrent webhook / return
  // settlement may already have marked it paid and granted the executions.
  const fresh = await findOne(pb, PURCHASES_COLLECTION, "reference = {:reference}", { reference });
  if (fresh && str(fresh, "status") === "paid") {
    return { ok: true, status: "paid", alreadySettled: true, units };
  }

  await pb.collection(PURCHASES_COLLECTION).update(str(purchase, "id"), {
    status: "paid",
    paid_at: verification.paid_at ?? new Date().toISOString(),
    provider_transaction_id: String(verification.id ?? ""),
    error_message: "",
  });

  await grantExecutionCredits(pb, {
    userId: str(purchase, "user_id"),
    units,
    reference,
  });

  // A failed confirmation email must never fail settlement.
  try {
    const buyer = asRecord(await pb.collection("users").getOne(str(purchase, "user_id")));
    const email = str(buyer, "email");
    if (email) {
      const { sendEmail, addonPurchaseEmail } = await import("./email.server");
      const sent = await sendEmail({
        to: email,
        ...addonPurchaseEmail("Workflow executions", units, "executions"),
      });
      if (!sent.ok) console.error("[execution-packs] confirmation email failed:", sent.error);
    }
  } catch (err) {
    console.error("[execution-packs] confirmation email failed:", err);
  }

  return { ok: true, status: "paid", alreadySettled: false, units };
}

async function grantExecutionCredits(
  pb: PocketBase,
  input: { userId: string; units: number; reference: string },
) {
  const existing = await findOne(pb, CREDITS_COLLECTION, "user_id = {:userId}", {
    userId: input.userId,
  });

  if (existing) {
    if (str(existing, "last_reference") === input.reference) return;
    await pb.collection(CREDITS_COLLECTION).update(str(existing, "id"), {
      units_purchased: num(existing, "units_purchased") + input.units,
      last_reference: input.reference,
    });
    return;
  }

  try {
    await pb.collection(CREDITS_COLLECTION).create({
      user_id: input.userId,
      kind: EXECUTION_CREDIT_KIND,
      units_purchased: input.units,
      units_used: 0,
      // Standing balance: never reset on a billing-period rollover.
      expires_monthly: false,
      first_purchased_at: new Date().toISOString(),
      last_reference: input.reference,
    });
  } catch {
    // The unique user_id index rejected a racing create: fold the units into
    // the row the other writer just made, unless it was this same reference.
    const row = await findOne(pb, CREDITS_COLLECTION, "user_id = {:userId}", {
      userId: input.userId,
    });
    if (!row) throw new Error("Could not record the purchased execution credit.");
    if (str(row, "last_reference") === input.reference) return;
    await pb.collection(CREDITS_COLLECTION).update(str(row, "id"), {
      units_purchased: num(row, "units_purchased") + input.units,
      last_reference: input.reference,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Consumption                                                         */
/* ------------------------------------------------------------------ */

/**
 * Spends up to `units` of purchased execution credit. Called ONLY after the
 * monthly included allowance is exhausted, so the included amount is always
 * consumed first.
 */
export async function consumeExecutionCredit(
  userId: string,
  units = 1,
): Promise<{ spent: number; remaining: number }> {
  if (units <= 0) return { spent: 0, remaining: 0 };
  const pb = await adminClient();
  const row = await findOne(pb, CREDITS_COLLECTION, "user_id = {:userId}", { userId });
  if (!row) return { spent: 0, remaining: 0 };

  const remaining = Math.max(0, num(row, "units_purchased") - num(row, "units_used"));
  const spent = Math.min(remaining, units);
  if (spent > 0) {
    await pb
      .collection(CREDITS_COLLECTION)
      .update(str(row, "id"), { units_used: num(row, "units_used") + spent });
  }
  return { spent, remaining: remaining - spent };
}

/* ------------------------------------------------------------------ */
/* Status reads                                                        */
/* ------------------------------------------------------------------ */

export interface ExecutionPackPurchaseStatus {
  found: boolean;
  status: string;
  packId: string | null;
  units: number;
  amountCents: number;
  activated: boolean;
}

export async function getExecutionPackPurchaseStatus(
  reference: string,
): Promise<ExecutionPackPurchaseStatus> {
  const pb = await adminClient();
  const purchase = await findOne(pb, PURCHASES_COLLECTION, "reference = {:reference}", {
    reference,
  });
  if (!purchase) {
    return { found: false, status: "unknown", packId: null, units: 0, amountCents: 0, activated: false };
  }
  const status = str(purchase, "status");
  return {
    found: true,
    status,
    packId: str(purchase, "pack_id"),
    units: num(purchase, "units"),
    amountCents: num(purchase, "amount_cents"),
    activated: status === "paid",
  };
}

/** True when `reference` belongs to `userId`; checked before anything is shown. */
export async function assertExecutionPackOwner(
  reference: string,
  userId: string,
): Promise<boolean> {
  const pb = await adminClient();
  const purchase = await findOne(pb, PURCHASES_COLLECTION, "reference = {:reference}", {
    reference,
  });
  return Boolean(purchase && str(purchase, "user_id") === userId);
      }
      
