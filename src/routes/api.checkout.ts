/**
 * Machine-to-machine checkout endpoint, called by synkra--web-main's
 * src/lib/checkout.functions.ts - NOT reachable from a browser directly.
 * web-main now owns the actual checkout UI (6-step flow: plan+billing
 * period+addons, customer info+student election, business info, marketing
 * attribution, marketing consent, payment). This repo's own checkout.tsx
 * stays in place as a simpler fallback, unaffected by anything here.
 *
 * Protected by the same X-Synkra-Secret header pattern already used
 * between synkra-core and this repo (see src/lib/notifications.functions.ts
 * for the outbound side of that same pattern) - CHECKOUT_API_SECRET here
 * must equal web-main's CLIENT_HUB_API_SECRET.
 *
 * Trusts input.amountCentsOverride, input.studentVerified, and the pricing
 * breakdown in metadata.addons as authoritative, because this whole route
 * is only reachable via that authenticated server-to-server call - not
 * because anything here re-derives them independently. See createCheckout's
 * own comments in billing.server.ts for why that's a deliberate choice
 * rather than an oversight.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PURCHASABLE_TIERS } from "@/lib/billing/config";

const addonSchema = z.object({
  id: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(1000),
  label: z.string().min(1).max(200),
});

const checkoutApiSchema = z.object({
  email: z.string().min(5).max(200),
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  businessName: z.string().max(120).optional(),
  howHeard: z.string().max(200).optional(),
  tier: z.enum(["free", ...PURCHASABLE_TIERS]),
  billingPeriod: z.enum(["monthly", "annual"]),
  amountCents: z.number().int().min(0),
  pricingVersion: z.string().min(1).max(40),
  addons: z.array(addonSchema).max(20).default([]),
  studentVerified: z.boolean().default(false),
  marketingConsent: z.boolean(),
  termsAccepted: z.boolean().refine((v) => v === true, {
    message: "Terms and Privacy Policy must be accepted to complete checkout.",
  }),
  termsVersion: z.string().min(1).max(40),
  privacyVersion: z.string().min(1).max(40),
});

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("X-Synkra-Secret");
        const expected = process.env["CHECKOUT_API_SECRET"];
        if (!expected) {
          console.error("[api/checkout] CHECKOUT_API_SECRET is not configured");
          return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
        }
        if (secret !== expected) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const parsed = checkoutApiSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid input." },
            { status: 400 },
          );
        }
        const data = parsed.data;

        const forwardedFor = request.headers.get("x-forwarded-for");
        const consentIp = forwardedFor?.split(",")[0]?.trim();

        const { createCheckout, BillingError } = await import("@/lib/billing/billing.server");
        try {
          const result = await createCheckout({
            email: data.email,
            name: data.name,
            tier: data.tier,
            businessName: data.businessName,
            source: "web",
            billingPeriod: data.billingPeriod,
            amountCentsOverride: data.amountCents,
            pricingVersion: data.pricingVersion,
            addons: data.addons,
            studentVerified: data.studentVerified,
            marketingConsent: data.marketingConsent,
            termsAccepted: data.termsAccepted,
            termsVersion: data.termsVersion,
            privacyVersion: data.privacyVersion,
            ...(data.phone ? { phone: data.phone } : {}),
            ...(data.howHeard ? { howHeard: data.howHeard } : {}),
            ...(consentIp ? { consentIp } : {}),
          });
          return Response.json(result);
        } catch (err) {
          if (err instanceof BillingError) {
            return Response.json({ ok: false, error: err.code, message: err.message }, { status: 400 });
          }
          console.error("[api/checkout] unexpected error:", err);
          return Response.json(
            { ok: false, error: "unknown", message: "Something went wrong." },
            { status: 500 },
          );
        }
      },
    },
  },
});
