/**
 * Execution top-up pack picker.
 *
 * Same purchase flow as `./addon-purchase-modal`: the browser names a published
 * pack id, the server recomputes the charge and returns a Paystack
 * authorization URL, and we redirect there. No pricing logic lives here — the
 * figures shown come from the shared, client-safe catalogue.
 */
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import pb from "@/lib/pocketbase";
import { startExecutionPackPurchaseFn } from "@/lib/billing/execution-packs.functions";
import {
  EXECUTION_PACK_LIST,
  formatExecutionUnitPrice,
  type ExecutionPackId,
} from "@/lib/billing/execution-packs";
import { formatZar } from "@/lib/billing/config";

export function ExecutionPackModal({ onClose }: { onClose: () => void }) {
  const [packId, setPackId] = useState<ExecutionPackId>("exec_1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = EXECUTION_PACK_LIST.find((p) => p.id === packId) ?? EXECUTION_PACK_LIST[0]!;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const result = (await startExecutionPackPurchaseFn({
        data: { token, packId },
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
      aria-label="Buy more workflow executions"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-xl p-6"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
      >
        <div className="flex items-start justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Buy more executions
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
          Purchased executions never expire. They're used only once your monthly included allowance
          runs out.
        </p>

        <div className="mt-5 flex flex-col gap-2" role="radiogroup" aria-label="Execution packs">
          {EXECUTION_PACK_LIST.map((pack) => {
            const active = pack.id === packId;
            return (
              <button
                key={pack.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPackId(pack.id)}
                className="synkra-focus flex items-center justify-between rounded-lg px-4 py-3 text-left"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: `1px solid ${active ? "var(--accent-green)" : "var(--border-default)"}`,
                }}
              >
                <span>
                  <span
                    style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {pack.executions.toLocaleString("en-ZA")} executions
                  </span>
                  <span className="block" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatExecutionUnitPrice(pack.id)}
                  </span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                  {formatZar(pack.priceZar * 100)}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3" style={{ fontSize: 13, color: "var(--state-error)" }} role="alert">
            {error}
          </p>
        )}

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
          Pay {formatZar(selected.priceZar * 100)}
        </button>
        <p className="mt-3 text-center" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          You'll be redirected to Paystack to complete payment securely.
        </p>
      </div>
    </div>
  );
            }
    
