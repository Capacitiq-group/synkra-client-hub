// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import pb from "@/lib/pocketbase";
import { checkRateLimit } from "@/lib/rateLimit";
import { isValidEmail, sanitizeEmail } from "@/lib/sanitize";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Synkra Client Portal" },
      { name: "description", content: "Request a password reset link for your Synkra account." },
      { property: "og:title", content: "Reset password — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Request a password reset link for your Synkra account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = sanitizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const { allowed } = checkRateLimit(`reset:${cleanEmail}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      setError("Too many requests. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      await pb.collection("users").requestPasswordReset(cleanEmail);
    } catch {
      // Do not reveal whether the account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          We'll email you a link to set a new password.
        </p>

        {sent ? (
          <p
            className="mt-6 rounded-sm px-3 py-2 text-xs"
            style={{ backgroundColor: "var(--state-info-bg)", color: "var(--state-info)" }}
          >
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              aria-label="Email"
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
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-4 inline-block text-xs" style={{ color: "var(--text-muted)" }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
