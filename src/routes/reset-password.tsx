// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import pb from "@/lib/pocketbase";
import { checkRateLimit } from "@/lib/rateLimit";
import { isValidEmail, sanitizeEmail, sanitizeInput } from "@/lib/sanitize";

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

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  height: 48,
  padding: "0 16px",
  color: "var(--text-primary)",
  fontSize: 15,
  width: "100%",
  outline: "none",
};

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = sanitizeEmail(sanitizeInput(email));
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const { allowed } = checkRateLimit(`reset-${cleanEmail}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      setError("Too many requests. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      await pb.collection("users").requestPasswordReset(cleanEmail);
    } catch {
      // Never reveal whether the account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div
      className="flex min-h-screen justify-center px-6 py-24 text-left"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Link
          to="/login"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--accent-green)" }}
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>

        {sent ? (
          <div style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
              Check your email
            </h1>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              If an account exists for that address, a reset link is on its way. Check your spam
              folder if you do not see it within a few minutes.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: 40,
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Account recovery
            </div>
            <h1 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
              Reset your password
            </h1>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              Enter your email address and we will send you a link to set a new password. The link
              expires in one hour.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="reset-email" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@business.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div
                  style={{
                    marginTop: 20,
                    backgroundColor: "var(--state-error-bg)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: 14,
                    color: "var(--state-error)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
                style={{
                  marginTop: 24,
                  width: "100%",
                  height: 48,
                  backgroundColor: "var(--accent-green)",
                  color: "#0A0A0A",
                  fontWeight: 600,
                  fontSize: 15,
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
