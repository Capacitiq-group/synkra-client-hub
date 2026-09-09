/**
 * Add-on purchase modal.
 *
 * Calls the already-existing, already-authoritative server functions in
 * `@/lib/billing/addons.functions` — this component adds no pricing logic of
 * its own. Add-on credit is sold as fixed-price prepaid packs (see
 * `@/lib/billing/addon-packs`), not an arbitrary quantity — the buyer picks
 * one of a curated set of pack sizes, the server recomputes the exact price
 * from that pack's id, starts a Paystack checkout, and this redirects to
 * `authorizationUrl` exactly like the existing plan checkout flow in
 * `checkout.tsx`.
 */
import { useState } from "react";
import { Loader2, X, Check } from "lucide-react";
import pb from "@/lib/pocketbase";
import { startAddonPurchaseFn } from "@/lib/billing/addons.functions";
import { ADDON_CATALOG, ADDON_UNAVAILABLE_MESSAGE, type AddonKind } from "@/lib/billing/addons";
import { packsForKind, type AddonPack } from "@/lib/billing/addon-packs";
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
  const packs = packsForKind(kind);
  const [selected, setSelected] = useState<AddonPack | null>(packs[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    // Defence in depth: the button is disabled for non-purchasable add-ons and
    // when nothing is selected, but the guard lives here too so no code path
    // can start a checkout without a real, published pack id.
    if (!product.purchasable || !selected) return;
    setError(null);
    setBusy(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const result = (await startAddonPurchaseFn({
        data: { token, packId: selected.id },
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
        className="w-full max-w-[440px] rounded-xl p-6"
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

        {product.purchasable && packs.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-2">
            {packs.map((pack) => {
              const isSelected = selected?.id === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelected(pack)}
                  className="synkra-focus flex items-center justify-between rounded-lg px-4 py-3 text-left"
                  style={{
                    border: isSelected
                      ? "1.5px solid var(--accent-green)"
                      : "1px solid var(--border-default)",
                    backgroundColor: isSelected ? "var(--bg-card)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{
                        border: isSelected
                          ? "1.5px solid var(--accent-green)"
                          : "1.5px solid var(--border-default)",
                        backgroundColor: isSelected ? "var(--accent-green)" : "transparent",
                      }}
                    >
                      {isSelected && <Check size={12} color="var(--bg-base)" strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {pack.units.toLocaleString("en-ZA")} {product.unit}
                    </span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                    {formatZar(Math.round(pack.priceZar * 100))}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-3" style={{ fontSize: 13, color: "var(--state-error)" }} role="alert">
            {error}
          </p>
        )}

        {product.purchasable ? (
          <button
            type="button"
            onClick={submit}
            disabled={busy || !selected}
            className="synkra-focus mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--bg-base)",
              fontSize: 14,
              fontWeight: 600,
              opacity: busy || !selected ? 0.6 : 1,
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {selected ? `Pay ${formatZar(Math.round(selected.priceZar * 100))}` : "Select a pack"}
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
            ? "Non-expiring balance, oldest pack used first. You'll be redirected to Paystack to complete payment securely."
            : `${ADDON_UNAVAILABLE_MESSAGE} We'll enable it here as soon as ${product.label} is connected.`}
        </p>
      </div>
    </div>
  );
                                          }
