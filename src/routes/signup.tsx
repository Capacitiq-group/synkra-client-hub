import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Public registration re-opened 28 Aug 2026.
 *
 * /signup is not a separate form — it sends the visitor straight into the
 * existing /checkout flow, which already does everything "sign up" needs:
 * pick a plan (free or paid), create the PocketBase account, verify via a
 * single-use magic-link email (the same mechanism as sign-in), and for paid
 * tiers take payment through Paystack before activating. See
 * src/lib/billing/billing.server.ts (createCheckout, resolveOrCreateUser,
 * issueMagicLink) for the authoritative flow — nothing new was built here on
 * purpose, since that path is already tested and idempotent.
 *
 * Deliberately not linked from the landing page or anywhere else in the app
 * yet — reachable only by navigating to /signup or /checkout directly. The
 * external APPLY_URL redirect this replaced is preserved below only as a
 * quick way to revert if needed.
 */
// const APPLY_URL = "https://www.synkra.co.za/apply";
/** Still exported: login.tsx links here and is deliberately left untouched. */
export const APPLY_URL = "https://www.synkra.co.za/apply";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Synkra" },
      {
        name: "description",
        content: "Create your Synkra account and activate your workspace in minutes.",
      },
      { property: "og:title", content: "Sign up — Synkra" },
      {
        property: "og:description",
        content: "Create your Synkra account and activate your workspace in minutes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/checkout" });
  },
});
