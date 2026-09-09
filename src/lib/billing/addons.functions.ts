/**
 * Client-callable add-on endpoints.
 *
 * Every function here is authenticated: the browser sends its PocketBase auth
 * token and nothing else that identifies an account. The user id is resolved
 * server-side from that token, so the browser can never say "grant credits to
 * user X". The browser names a fixed pack id (see ./addon-packs); price and
 * units are always recomputed server-side from that id, never trusted.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authSchema = z.object({ token: z.string().min(10) });
const purchaseSchema = authSchema.extend({
  packId: z.string().min(1).max(64),
});
const statusSchema = authSchema.extend({ reference: z.string().min(8).max(200) });
const historySchema = authSchema.extend({ limit: z.number().int().min(1).max(200).optional() });

type Failure = { ok: false; error: string; message: string };

/**
 * Single entry point for authentication + error shaping, mirroring the guard in
 * `./billing.functions`. Token verification happens *inside* the guard so a
 * configuration problem, an expired session and a business error are all
 * reported distinctly instead of collapsing into one opaque throw.
 */
async function guardedUser<T>(
  token: string,
  run: (userId: string) => Promise<T>,
): Promise<T | Failure> {
  const { BillingError } = await import("./billing.server");
  const { verifyUserToken, PocketBaseAuthError, PocketBaseConfigError } = await import(
    "@/lib/usage/pocketbase.server"
  );
  try {
    const { userId } = await verifyUserToken(token);
    return await run(userId);
  } catch (err) {
    if (err instanceof PocketBaseConfigError) {
      // Full detail to the server log, never to the browser.
      console.error("[addons] configuration error:", err.code, err.message);
      return { ok: false as const, error: "server_misconfigured", message: err.publicMessage };
    }
    if (err instanceof PocketBaseAuthError) {
      return { ok: false as const, error: "unauthenticated", message: err.message };
    }
    if (err instanceof BillingError) {
      return { ok: false as const, error: err.code, message: err.message };
    }
    console.error("[addons] unexpected error:", err);
    return {
      ok: false as const,
      error: "unknown",
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Purchased add-on balances for the signed-in account. */
export const getAddonBalancesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { listPrepaidBalances } = await import("./addon-ledger.server");
      return { ok: true as const, balances: await listPrepaidBalances(userId) };
    }),
  );

/** Every prepaid pack this account has ever bought, oldest first (FIFO order). */
export const getAddonLotsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { listAddonLots } = await import("./addon-ledger.server");
      return { ok: true as const, lots: await listAddonLots(userId) };
    }),
  );

/** Consumption ledger — every unit ever drawn down, newest first. */
export const getAddonConsumptionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => historySchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { listAddonConsumption } = await import("./addon-ledger.server");
      return { ok: true as const, entries: await listAddonConsumption(userId, data.limit ?? 50) };
    }),
  );

/** Transaction history — every purchase attempt, pending/paid/failed alike. */
export const getAddonPurchaseHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => historySchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { listAddonPurchases } = await import("./addons.server");
      return { ok: true as const, purchases: await listAddonPurchases(userId, data.limit ?? 50) };
    }),
  );

/** Starts a Paystack checkout for a fixed add-on pack. Price/units are recomputed server-side. */
export const startAddonPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => purchaseSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { createAddonCheckout } = await import("./addons.server");
      return createAddonCheckout({ userId, packId: data.packId });
    }),
  );

/**
 * Status of one add-on purchase. Also settles it, so a buyer who returns before
 * the webhook lands is credited immediately — settlement verifies with Paystack
 * and is idempotent, so the later webhook is a no-op.
 */
export const getAddonPurchaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { settleAddonPurchase, getAddonPurchaseStatus, assertAddonPurchaseOwner } = await import(
        "./addons.server"
      );
      // Ownership check before anything is disclosed about the reference.
      const owns = await assertAddonPurchaseOwner(data.reference, userId);
      if (!owns) {
        return {
          ok: true as const,
          found: false,
          status: "unknown",
          kind: null,
          units: 0,
          amountCents: 0,
          activated: false,
        };
      }
      try {
        await settleAddonPurchase(data.reference, "return");
      } catch {
        /* verification failures are reflected in the status read below */
      }
      return { ok: true as const, ...(await getAddonPurchaseStatus(data.reference)) };
    }),
  );
