/**
 * Public checkout. A buyer needs no account: they pick a plan, give their name
 * and email, and are sent to Paystack. Prices shown here come from
 * `@/lib/plans` through planOptions() and are recomputed server-side, so a
 * tampered form cannot change what is charged.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Mail } from "lucide-react";
import { createCheckoutFn, requestMagicLinkFn } from "@/lib/billing/billing.functions";
import { formatZar, planOptions, type PlanOption } from "@/lib/billing/config";
import type { PlanTier } from "@/lib/plans";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { plan?: PlanTier } => {
    const plan = String(search["plan"] ?? "");
    return ["free", "basic", "pro"].includes(plan) ? { plan: plan as PlanTier } : {};
  },
  head: () => ({
    meta: [
      { title: "Checkout — Synkra Client Portal" },
      {
        name: "description",
        content: "Choose your Synkra plan and activate your workspace in minutes.",
      },
      { property: "og:title", content: "Checkout — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Choose your Synkra plan and activate your workspace in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

type Result =
  | {
      ok: true;
      reference: string;
      status: "pending" | "activated";
      authorizationUrl?: string;
      amountCents: number;
    }
  | { ok: false; error: string; message: string };

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="rounded-xl p-5 text-left transition-colors"
      style={{
        border: selected ? "2px solid var(--accent-green)" : "1px solid var(--border-default)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">{plan.name}</span>
        <span className="text-[15px] font-bold">
          {plan.priceZar === 0 ? "Free" : `${formatZar(plan.priceCents)}/mo`}
        </span>
      </div>
      {plan.studentDiscountApplied && (
        <span
          className="mt-1 inline-block text-[12px] font-medium"
          style={{ color: "var(--accent-green)" }}
        >
          Student discount applied
        </span>
      )}
      <ul className="mt-4 space-y-2">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px]">
            <Check size={14} style={{ color: "var(--accent-green)", marginTop: 3 }} />
            <span style={{ color: "var(--text-secondary)" }}>{item}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function CheckoutPage() {
  const { plan } = Route.useSearch();
  const [tier, setTier] = useState<PlanTier>(plan ?? "basic");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  // Recomputed on every keystroke — cheap, pure, client-side preview only.
  // The actual charge is always recomputed server-side in createCheckout.
  const plans = planOptions(email);

  const selected = plans.find((item) => item.tier === tier);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = (await createCheckoutFn({
        data: {
          email,
          name,
          businessName,
          tier: tier as "free" | "basic" | "pro",
          ...(phone ? { phone } : {}),
          ...(howHeard ? { howHeard } : {}),
        },
      })) as unknown as Result;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      setActivated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  if (activated) {
    return (
      <main className="mx-auto w-full max-w-[560px] p-6 md:p-12">
        <div
          className="rounded-xl p-8 text-center"
          style={{
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <Mail size={28} style={{ color: "var(--accent-green)", margin: "0 auto" }} />
          <h1 className="mt-4 text-[22px] font-bold">Check your email</h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Your {selected?.name} workspace is ready. We sent a single-use sign-in link to {email}.
            It expires in 30 minutes.
          </p>
          {/*
            Checkout accounts don't have a real password — createCheckout
            in billing.server.ts sets a random one that's never disclosed,
            because sign-in for these accounts is magic-link only by
            design. A "sign in with a password instead" link here would
            send someone to a form they can never actually complete.
          */}
          {resent ? (
            <p className="mt-6 text-[14px]" style={{ color: "var(--accent-green)" }}>
              Sent. Check {email} again.
            </p>
          ) : (
            <button
              type="button"
              disabled={resending}
              onClick={async () => {
                setResending(true);
                try {
                  await requestMagicLinkFn({ data: { email } });
                } finally {
                  setResending(false);
                  setResent(true);
                }
              }}
              className="mt-6 inline-block text-[14px] underline disabled:opacity-60"
            >
              {resending ? "Sending…" : "Didn't get it? Send the link again"}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] p-4 md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Choose your plan</h1>
      <p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Pay in ZAR by card. You will get a sign-in link by email as soon as payment clears.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((item) => (
          <PlanCard
            key={item.tier}
            plan={item}
            selected={item.tier === tier}
            onSelect={() => setTier(item.tier)}
          />
        ))}
      </div>

      <form
        onSubmit={submit}
        className="mt-10 max-w-[520px] rounded-xl p-6"
        style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
      >
        <h2 className="text-[16px] font-semibold">Your details</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>Full name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="mt-1 h-11 w-full rounded-lg px-3 text-[14px]"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>Business name</span>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={120}
              className="mt-1 h-11 w-full rounded-lg px-3 text-[14px]"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>Email address</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              className="mt-1 h-11 w-full rounded-lg px-3 text-[14px]"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>Phone (optional)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              className="mt-1 h-11 w-full rounded-lg px-3 text-[14px]"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
          </label>
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-secondary)" }}>How did you hear about us? (optional)</span>
            <select
              value={howHeard}
              onChange={(e) => setHowHeard(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg px-3 text-[14px]"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Select an option</option>
              <option value="google">Google search</option>
              <option value="social">Social media</option>
              <option value="referral">Referral from someone</option>
              <option value="synkra_website">Synkra website / another Synkra product</option>
              <option value="agency_client">I'm an existing Synkra Agency client</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="mt-4 text-[13px]" style={{ color: "var(--state-error)" }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold"
          style={{
            backgroundColor: "var(--accent-green)",
            color: "var(--bg-base)",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {selected && selected.priceZar > 0
            ? `Pay ${formatZar(selected.priceCents)}`
            : "Activate free plan"}
        </button>
        <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
