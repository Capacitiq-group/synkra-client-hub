// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isValidEmail, sanitizeEmail } from "@/lib/sanitize";
import { resetActivity } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { reason?: string } =>
    typeof search["reason"] === "string" ? { reason: search["reason"] as string } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Synkra Client Portal" },
      { name: "description", content: "Sign in to your Synkra client portal account." },
      { property: "og:title", content: "Sign in — Synkra Client Portal" },
      { property: "og:description", content: "Sign in to your Synkra client portal account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { reason } = Route.useSearch();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);
  const isReady = useAuthStore((s) => s.isReady);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isReady && user && reason !== "expired") navigate({ to: "/dashboard", replace: true });
  }, [isReady, user, reason, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = sanitizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await login(cleanEmail, password);
      resetActivity();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div
          className="font-extrabold"
          style={{ color: "var(--accent-green)", letterSpacing: "0.1em", fontSize: 16 }}
        >
          SYNKRA
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          Client Portal
        </div>

        {reason === "expired" && (
          <p
            className="mt-4 rounded-sm px-3 py-2 text-xs"
            style={{ backgroundColor: "var(--state-info-bg)", color: "var(--state-info)" }}
          >
            Your session ended due to inactivity.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-sm border px-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-sm border px-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--state-error)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-sm text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--accent-green-foreground)",
            }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link
          to="/reset-password"
          className="mt-4 inline-block text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
