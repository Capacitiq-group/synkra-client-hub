/**
 * Client-callable add-on endpoints.
 *
 * Every function here is authenticated: the browser sends its PocketBase auth
 * token and nothing else that identifies an account. The user id is resolved
 * server-side from that token, so the browser can never say "grant credits to
 * user X". Prices are recomputed from `./addons`; the browser sends only an
 * add-on kind and a whole number of packs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADDON_KINDS, ADDON_UNAVAILABLE_MESSAGE, isAddonPurchasable } from "./addons";

const authSchema = z.object({ token: z.string().min(10) });
const purchaseSchema = authSchema.extend({
  kind: z.enum(ADDON_KINDS),
  packs: z.number().int().min(1).max(50),
});
const statusSchema = authSchema.extend({ reference: z.string().min(8).max(200) });

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
      const { listAddonBalances } = await import("./addons.server");
      return { ok: true as const, balances: await listAddonBalances(userId) };
    }),
  );

/** Starts a Paystack checkout for an add-on. The price is computed server-side. */
export const startAddonPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => purchaseSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      // Rejected before any provider or database work happens; the same check
      // is repeated inside createAddonCheckout so no call path can skip it.
      if (!isAddonPurchasable(data.kind)) {
        const { BillingError } = await import("./billing.server");
        throw new BillingError("addon_unavailable", ADDON_UNAVAILABLE_MESSAGE);
      }
      const { createAddonCheckout } = await import("./addons.server");
      return createAddonCheckout({ userId, kind: data.kind, packs: data.packs });
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
