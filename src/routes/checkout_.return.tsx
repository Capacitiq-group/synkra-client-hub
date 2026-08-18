/**
 * Paystack return page. The reference in the URL proves nothing on its own, so
 * the status is always read from the server, which verifies the transaction
 * with Paystack before reporting it as paid.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { getCheckoutStatusFn } from "@/lib/billing/billing.functions";
import { formatZar } from "@/lib/billing/config";

export const Route = createFileRoute("/checkout_/return")({
  validateSearch: (search: Record<string, unknown>): { reference: string } => ({
    reference: String(search["reference"] ?? search["trxref"] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Payment status — Synkra Client Portal" },
      { name: "description", content: "Confirming your Synkra payment and activating access." },
      { property: "og:title", content: "Payment status — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Confirming your Synkra payment and activating access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutReturnPage,
});

type Status =
  | {
      ok: true;
      found: boolean;
      status: string;
      planName: string;
      amountCents: number;
      maskedEmail: string;
      activated: boolean;
    }
  | { ok: false; error: string; message: string };

function CheckoutReturnPage() {
  const { reference } = Route.useSearch();

  const { data, isLoading, error } = useQuery({
    queryKey: ["checkout-status", reference],
    enabled: reference.length > 7,
    queryFn: async () =>
      (await getCheckoutStatusFn({ data: { reference } })) as unknown as Status,
    // The webhook may land a moment after the buyer returns.
    refetchInterval: (query) => {
      const value = query.state.data as Status | undefined;
      return value && value.ok && value.activated ? false : 3000;
    },
    retry: 1,
  });

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto w-full max-w-[560px] p-6 md:p-12">
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
      >
        {children}
      </div>
    </main>
  );

  if (!reference) {
    return shell(
      <>
        <AlertTriangle size={28} style={{ color: "var(--state-warning)", margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">No payment reference</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          This page needs the reference Paystack sends back after payment.
        </p>
        <Link to="/checkout" className="mt-6 inline-block text-[14px] underline">
          Back to checkout
        </Link>
      </>,
    );
  }

  if (isLoading) {
    return shell(
      <>
        <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">Confirming your payment…</h1>
      </>,
    );
  }

  if (error || !data || data.ok === false || !data.found) {
    return shell(
      <>
        <AlertTriangle size={28} style={{ color: "var(--state-error)", margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">We could not confirm this payment</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          {data && data.ok === false
            ? data.message
            : "The reference was not found. If you were charged, contact support and quote it."}
        </p>
        <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Reference: {reference}
        </p>
      </>,
    );
  }

  if (!data.activated) {
    return shell(
      <>
        <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">Waiting for the bank</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Payment status: {data.status}. This page updates itself — no need to reload.
        </p>
        <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Reference: {reference}
        </p>
      </>,
    );
  }

  return shell(
    <>
      <CheckCircle2 size={28} style={{ color: "var(--accent-green)", margin: "0 auto" }} />
      <h1 className="mt-4 text-[22px] font-bold">Payment received</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Your {data.planName} plan is active
        {data.amountCents > 0 ? ` (${formatZar(data.amountCents)})` : ""}. We sent a single-use
        sign-in link to {data.maskedEmail}; it expires in 30 minutes.
      </p>
      <Link to="/login" className="mt-6 inline-block text-[14px] underline">
        Go to sign in
      </Link>
    </>,
  );
}
