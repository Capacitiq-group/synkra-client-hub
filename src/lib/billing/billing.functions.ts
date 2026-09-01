/**
 * Client-callable billing endpoints.
 *
 * These are public by definition (a buyer has no account yet), so every
 * handler validates its input, rate-limits by identity where it matters and
 * never trusts a price, tier amount or user id supplied by the browser: the
 * amount is always recomputed from `@/lib/plans` on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PURCHASABLE_TIERS } from "./config";

const checkoutSchema = z.object({
  email: z.string().min(5).max(200),
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  businessName: z.string().min(1).max(120),
  howHeard: z.string().max(200).optional(),
  tier: z.enum(["free", ...PURCHASABLE_TIERS]),
});

const referenceSchema = z.object({ reference: z.string().min(8).max(200) });
const emailSchema = z.object({ email: z.string().min(5).max(200) });
const magicSchema = z.object({ token: z.string().min(32).max(200) });
const authSchema = z.object({ token: z.string().min(10) });

type Failure = { ok: false; error: string; message: string };

async function guard<T>(run: () => Promise<T>): Promise<T | Failure> {
  const { BillingError } = await import("./billing.server");
  const { PocketBaseAuthError, PocketBaseConfigError } = await import(
    "@/lib/usage/pocketbase.server"
  );
  try {
    return await run();
  } catch (err) {
    if (err instanceof PocketBaseConfigError) {
      // Configuration detail stays in the server log; the browser gets a
      // generic message and never a variable name or value.
      console.error("[billing] configuration error:", err.code, err.message);
      return { ok: false as const, error: "server_misconfigured", message: err.publicMessage };
    }
    if (err instanceof PocketBaseAuthError) {
      return { ok: false as const, error: "unauthenticated", message: err.message };
    }
    if (err instanceof BillingError) {
      return { ok: false as const, error: err.code, message: err.message };
    }
    return {
      ok: false as const,
      error: "unknown",
      message: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}


/** Starts a checkout. The charge amount is derived server-side from the tier. */
export const createCheckoutFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { createCheckout } = await import("./billing.server");
    return guard(() =>
      createCheckout({
        email: data.email,
        name: data.name,
        tier: data.tier,
        businessName: data.businessName,
        source: "web",
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.howHeard ? { howHeard: data.howHeard } : {}),
      }),
    );
  });

/**
 * Return-page status. Also settles the reference, so a customer who returns
 * before the webhook arrives is still provisioned immediately (and the later
 * webhook is a no-op). The same reference space carries both subscription
 * checkouts and add-on purchases, so the type is decided here — there is only
 * one settlement path per type and both are idempotent.
 */
export const getCheckoutStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => referenceSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCheckoutStatus, settleTransaction } = await import("./billing.server");
    const { isAddonReference, settleAddonPurchase, getAddonPurchaseStatus } = await import(
      "./addons.server"
    );
    return guard(async () => {
      if (isAddonReference(data.reference)) {
        try {
          await settleAddonPurchase(data.reference, "return");
        } catch {
          /* verification failures are reflected in the status read below */
        }
        const addon = await getAddonPurchaseStatus(data.reference);
        return {
          ok: true as const,
          kind: "addon" as const,
          found: addon.found,
          status: addon.status,
          planName: addon.kind ? `${addon.units} units` : "",
          amountCents: addon.amountCents,
          maskedEmail: "",
          activated: addon.activated,
          addonKind: addon.kind,
          units: addon.units,
        };
      }
      try {
        await settleTransaction(data.reference, "return");
      } catch {
        /* verification failures are reflected in the status read below */
      }
      return {
        ok: true as const,
        kind: "subscription" as const,
        ...(await getCheckoutStatus(data.reference)),
      };
    });
  });


/** Sends a single-use sign-in link. Always reports success. */
export const requestMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }) => {
    const { requestMagicLink } = await import("./billing.server");
    return guard(() => requestMagicLink(data.email));
  });

/** Exchanges a magic-link token for a real session. */
export const consumeMagicLinkFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => magicSchema.parse(data))
  .handler(async ({ data }) => {
    const { consumeMagicLink } = await import("./billing.server");
    return guard(async () => {
      const session = await consumeMagicLink(data.token);
      return {
        ok: true as const,
        token: session.token,
        userId: String(session.record["id"] ?? ""),
        email: String(session.record["email"] ?? ""),
      };
    });
  });

/** Billing state for the signed-in account. Requires a verified PB token. */
export const getBillingOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authSchema.parse(data))
  .handler(async ({ data }) =>
    // Token verification runs inside guard(), so an expired session, a server
    // misconfiguration and a billing error each report distinctly.
    guard(async () => {
      const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
      const { getBillingOverview } = await import("./billing.server");
      const { userId } = await verifyUserToken(data.token);
      return { ok: true as const, ...(await getBillingOverview(userId)) };
    }),
  );

/** Starts an upgrade for the signed-in account, reusing their own email. */
export const startUpgradeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    authSchema.extend({ tier: z.enum(PURCHASABLE_TIERS) }).parse(data),
  )
  .handler(async ({ data }) =>
    guard(async () => {
      const { verifyUserToken, adminClient } = await import("@/lib/usage/pocketbase.server");
      const { createCheckout } = await import("./billing.server");
      const { userId } = await verifyUserToken(data.token);
      const pb = await adminClient();
      const user = (await pb.collection("users").getOne(userId)) as unknown as Record<
        string,
        unknown
      >;
      return createCheckout({
        email: String(user["email"] ?? ""),
        name: String(user["name"] ?? "") || String(user["email"] ?? ""),
        tier: data.tier,
        source: "upgrade",
      });
    }),
  );
