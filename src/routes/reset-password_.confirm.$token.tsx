// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import pb from "@/lib/pocketbase";

export const Route = createFileRoute("/reset-password_/confirm/$token")({
  head: () => ({
    meta: [
      { title: "Set a new password — Synkra Client Portal" },
      { name: "description", content: "Choose a new password for your Synkra account." },
      { property: "og:title", content: "Set a new password — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Choose a new password for your Synkra account.",
      },
    ],
  }),
  component: ConfirmResetPage,
});

const MIN_PASSWORD_LENGTH = 8;

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

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
};

function ConfirmResetPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenDead, setTokenDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(
      () => navigate({ to: "/login", search: { reset: "success" }, replace: true }),
      2500,
    );
    return () => clearTimeout(timer);
  }, [done, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTokenDead(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await pb.collection("users").confirmPasswordReset(token, password, confirm);
      pb.authStore.clear();
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const data = (err as { response?: { data?: Record<string, { message?: string }> } })?.response
        ?.data;
      const tokenError = data?.["token"]?.message;
      const passwordError = data?.["password"]?.message;

      if (tokenError || /token|expired|invalid/i.test(message)) {
        setTokenDead(true);
        setError("This reset link has expired or is no longer valid.");
      } else if (passwordError) {
        setError(passwordError);
      } else if (/failed to fetch|network/i.test(message)) {
        setError("We could not reach the server. Check your connection and try again.");
      } else {
        setError("We could not reset your password. Please request a new reset link.");
      }
    } finally {
      setBusy(false);
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--accent-green)",
          }}
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>

        {done ? (
          <div style={{ marginTop: 40 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
              Your password has been reset.
            </h1>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              Taking you to the sign in page…
            </p>
            <Link
              to="/login"
              search={{ reset: "success" }}
              className="transition-opacity hover:opacity-90"
              style={{
                marginTop: 24,
                width: "100%",
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--accent-green)",
                color: "#0A0A0A",
                fontWeight: 600,
                fontSize: 15,
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
              }}
            >
              Go to sign in
            </Link>
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
            <h1
              style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}
            >
              Set a new password
            </h1>
            <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
              Choose a new password for your account. It must be at least {MIN_PASSWORD_LENGTH}{" "}
              characters long.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label htmlFor="new-password" style={labelStyle}>
                  New password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      lineHeight: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6, marginTop: 20 }}>
                <label htmlFor="confirm-password" style={labelStyle}>
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                  {tokenDead && (
                    <>
                      {" "}
                      <Link to="/reset-password" style={{ color: "var(--accent-green)" }}>
                        Request a new reset link
                      </Link>
                      .
                    </>
                  )}
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
                {busy ? <Loader2 size={18} className="animate-spin" /> : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
            }
