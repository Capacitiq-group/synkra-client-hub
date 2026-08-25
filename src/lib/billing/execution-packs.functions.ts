/**
 * Client-callable execution top-up pack endpoints.
 *
 * Deliberately mirrors `./addons.functions`: the browser sends its PocketBase
 * auth token plus a published pack id, the user id is resolved server-side from
 * the token, and the charge is recomputed from `./execution-packs`. The add-on
 * endpoints are untouched — this is a separate purchasable kind.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXECUTION_PACK_IDS } from "./execution-packs";

const authSchema = z.object({ token: z.string().min(10) });
const purchaseSchema = authSchema.extend({ packId: z.enum(EXECUTION_PACK_IDS) });
const statusSchema = authSchema.extend({ reference: z.string().min(8).max(200) });

type Failure = { ok: false; error: string; message: string };

/** Authentication + error shaping, identical in shape to the add-on guard. */
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
      console.error("[execution-packs] configuration error:", err.code, err.message);
      return { ok: false as const, error: "server_misconfigured", message: err.publicMessage };
    }
    if (err instanceof PocketBaseAuthError) {
      return { ok: false as const, error: "unauthenticated", message: err.message };
    }
    if (err instanceof BillingError) {
      return { ok: false as const, error: err.code, message: err.message };
    }
    console.error("[execution-packs] unexpected error:", err);
    return {
      ok: false as const,
      error: "unknown",
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Standing (non-expiring) purchased execution balance for the signed-in account. */
export const getExecutionCreditBalanceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { getExecutionCreditBalance } = await import("./execution-packs.server");
      return { ok: true as const, balance: await getExecutionCreditBalance(userId) };
    }),
  );

/** Starts a Paystack checkout for one execution pack. Price is server-side. */
export const startExecutionPackPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => purchaseSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const { createExecutionPackCheckout } = await import("./execution-packs.server");
      return createExecutionPackCheckout({ userId, packId: data.packId });
    }),
  );

/**
 * Status of one execution pack purchase. Settles it first, so a buyer who
 * returns before the webhook lands is credited immediately; settlement verifies
 * with Paystack and is idempotent, so the later webhook is a no-op.
 */
export const getExecutionPackPurchaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data }) =>
    guardedUser(data.token, async (userId) => {
      const {
        settleExecutionPackPurchase,
        getExecutionPackPurchaseStatus,
        assertExecutionPackOwner,
      } = await import("./execution-packs.server");
      const owns = await assertExecutionPackOwner(data.reference, userId);
      if (!owns) {
        return {
          ok: true as const,
          found: false,
          status: "unknown",
          packId: null,
          units: 0,
          amountCents: 0,
          activated: false,
        };
      }
      try {
        await settleExecutionPackPurchase(data.reference, "return");
      } catch {
        /* verification failures are reflected in the status read below */
      }
      return { ok: true as const, ...(await getExecutionPackPurchaseStatus(data.reference)) };
    }),
  );
        
