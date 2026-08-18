/**
 * Magic-link landing page. The token is exchanged once, server-side: the server
 * checks the hash, the 30-minute expiry and the single-use flag, then mints a
 * real PocketBase session for the existing user id (no account is replaced).
 */
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import pb from "@/lib/pocketbase";
import { consumeMagicLinkFn, requestMagicLinkFn } from "@/lib/billing/billing.functions";

export const Route = createFileRoute("/auth/magic")({
  validateSearch: (search: Record<string, unknown>): { token: string } => ({
    token: String(search["token"] ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Signing you in — Synkra Client Portal" },
      { name: "description", content: "Completing your single-use Synkra sign-in link." },
      { property: "og:title", content: "Signing you in — Synkra Client Portal" },
      { property: "og:description", content: "Completing your single-use Synkra sign-in link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MagicLinkPage,
});

type Consumed = { ok: true; token: string; email: string } | { ok: false; message: string };

function MagicLinkPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token || token.length < 32) {
      setError("This sign-in link is not valid.");
      return;
    }
    void (async () => {
      try {
        const result = (await consumeMagicLinkFn({ data: { token } })) as unknown as Consumed;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        pb.authStore.save(result.token, null);
        await pb.collection("users").authRefresh();
        await navigate({ to: "/dashboard" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete sign-in.");
      }
    })();
  }, [token, navigate]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    try {
      await requestMagicLinkFn({ data: { email } });
    } finally {
      setResent(true);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[520px] p-6 md:p-12">
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
      >
        {!error ? (
          <>
            <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto" }} />
            <h1 className="mt-4 text-[22px] font-bold">Signing you in…</h1>
          </>
        ) : (
          <>
            <AlertTriangle size={28} style={{ color: "var(--state-error)", margin: "0 auto" }} />
            <h1 className="mt-4 text-[22px] font-bold">Sign-in link unavailable</h1>
            <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              {error} Links last 30 minutes and can be used once.
            </p>

            {resent ? (
              <p className="mt-6 text-[14px]" style={{ color: "var(--text-secondary)" }}>
                If that address has an account, a fresh link is on its way.
              </p>
            ) : (
              <form onSubmit={resend} className="mt-6 text-left">
                <label className="block text-[13px]">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Email a new link to yourself
                  </span>
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
                <button
                  type="submit"
                  className="mt-4 h-11 w-full rounded-lg text-[14px] font-semibold"
                  style={{ backgroundColor: "var(--accent-green)", color: "var(--bg-base)" }}
                >
                  Send new link
                </button>
              </form>
            )}

            <Link to="/login" className="mt-6 inline-block text-[14px] underline">
              Sign in with a password
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
