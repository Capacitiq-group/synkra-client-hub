/**
 * Add-on purchase modal.
 *
 * Calls the already-existing, already-authoritative server functions in
 * `@/lib/billing/addons.functions` — this component adds no pricing logic of
 * its own. It shows the pack price (computed server-side, this is just a
 * live preview using the same public catalog), lets the buyer choose a pack
 * count, starts a Paystack checkout, and redirects to `authorizationUrl`
 * exactly like the existing plan checkout flow in `checkout.tsx`.
 */
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import pb from "@/lib/pocketbase";
import { startAddonPurchaseFn } from "@/lib/billing/addons.functions";
import {
  ADDON_CATALOG,
  ADDON_UNAVAILABLE_MESSAGE,
  addonPackPriceZar,
  type AddonKind,
} from "@/lib/billing/addons";
import { formatZar } from "@/lib/billing/config";

/** Small pill reused wherever a not-yet-available add-on is shown. */
export function ComingSoonBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-muted)",
        border: "1px solid var(--border-default)",
        backgroundColor: "var(--bg-elevated)",
      }}
    >
      Coming soon
    </span>
  );
}

interface Props {
  kind: AddonKind;
  onClose: () => void;
}

export function AddonPurchaseModal({ kind, onClose }: Props) {
  const product = ADDON_CATALOG[kind];
  const [packs, setPacks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packPriceZar = addonPackPriceZar(kind);
  const totalZar = packPriceZar * packs;
  const totalUnits = product.packSize * packs;

  async function submit() {
    // Defence in depth: the button is disabled for non-purchasable add-ons, but
    // the guard lives here too so no code path can start a checkout for them.
    if (!product.purchasable) return;
    setError(null);
    setBusy(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const result = (await startAddonPurchaseFn({
        data: { token, kind, packs },
      })) as unknown as
        | { ok: true; authorizationUrl?: string }
        | { ok: false; error: string; message: string };

      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      setError("Could not start checkout — no payment link was returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Buy ${product.label} add-on`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-xl p-6"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-start justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Buy {product.label}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="synkra-focus rounded-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {product.description}
        </p>

        <div className="mt-5">
          <label className="block text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Number of packs ({product.packSize} {product.unit} each)
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPacks((p) => Math.max(1, p - 1))}
              disabled={packs <= 1}
              className="synkra-focus flex h-9 w-9 items-center justify-center rounded-md"
              style={{ border: "1px solid var(--border-default)", opacity: packs <= 1 ? 0.5 : 1 }}
            >
              −
            </button>
            <span
              className="min-w-[2ch] text-center"
              style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
            >
              {packs}
            </span>
            <button
              type="button"
              onClick={() => setPacks((p) => Math.min(product.maxPacks, p + 1))}
              disabled={packs >= product.maxPacks}
              className="synkra-focus flex h-9 w-9 items-center justify-center rounded-md"
              style={{
                border: "1px solid var(--border-default)",
                opacity: packs >= product.maxPacks ? 0.5 : 1,
              }}
            >
              +
            </button>
          </div>
        </div>

        <div
          className="mt-5 flex items-center justify-between rounded-lg px-4 py-3"
          style={{ backgroundColor: "var(--bg-card)" }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {totalUnits.toLocaleString("en-ZA")} {product.unit}
            {product.monthly ? " / month" : ""}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatZar(Math.round(totalZar * 100))}
          </span>
        </div>

        {error && (
          <p className="mt-3" style={{ fontSize: 13, color: "var(--state-error)" }} role="alert">
            {error}
          </p>
        )}

        {product.purchasable ? (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="synkra-focus mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--bg-base)",
              fontSize: 14,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Pay {formatZar(Math.round(totalZar * 100))}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-5 flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg"
            style={{
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <ComingSoonBadge />
          </button>
        )}
        <p className="mt-3 text-center" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {product.purchasable
            ? "You'll be redirected to Paystack to complete payment securely."
            : `${ADDON_UNAVAILABLE_MESSAGE} We'll enable it here as soon as ${product.label} is connected.`}
        </p>
      </div>
    </div>
  );
}
