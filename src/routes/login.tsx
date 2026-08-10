// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { connectionProblemMessage, signIn } from "@/lib/auth";
import { isValidEmail, sanitizeEmail, sanitizeInput } from "@/lib/sanitize";
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

const PROOF = [
  "Five ready-to-use automation templates",
  "Email automation with no API costs",
  "Full activity log for every run",
];

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

function Wordmark() {
  return (
    <div
      style={{
        color: "var(--accent-green)",
        fontSize: 20,
        fontWeight: 800,
        letterSpacing: "0.1em",
      }}
    >
      SYNKRA
    </div>
  );
}

function LoginPage() {
  const { reason } = Route.useSearch();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isReady = useAuthStore((s) => s.isReady);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lockMinutes, setLockMinutes] = useState(0);

  useEffect(() => {
    if (isReady && user && reason !== "expired") navigate({ to: "/dashboard", replace: true });
  }, [isReady, user, reason, navigate]);

  useEffect(() => {
    if (lockMinutes <= 0) return;
    const timer = setInterval(() => setLockMinutes((m) => (m > 1 ? m - 1 : 0)), 60000);
    return () => clearInterval(timer);
  }, [lockMinutes]);

  const locked = lockMinutes > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setError(null);

    const cleanEmail = sanitizeEmail(sanitizeInput(email));
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setBusy(true);
    const result = await signIn(cleanEmail, password);
    setBusy(false);

    if (result.success && result.user) {
      setFailures(0);
      useAuthStore.setState({ user: result.user as never });
      resetActivity();
      if (result.user.onboarding_completed) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/dashboard", search: { onboarding: true }, replace: true });
      }
      return;
    }

    setFailures((f) => f + 1);
    const code = result.error ?? "unknown";
    if (code.startsWith("rate_limited:")) {
      setLockMinutes(Number(code.split(":")[1]) || 15);
      setError("Too many failed attempts. Please wait 15 minutes before trying again.");
    } else if (code === "unreachable") {
      setError(connectionProblemMessage());
    } else if (code === "not_verified") {
      setError("Please verify your email address before signing in. Check your inbox.");
    } else if (code === "suspended") {
      setError("Your account has been suspended. Contact hello@synkra.co.za.");
    } else {
      setError("The email or password is not correct.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row text-left" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left editorial column - hidden on mobile */}
      <div
        className="hidden md:flex flex-col justify-center border-r"
        style={{
          width: "55%",
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          padding: 64,
        }}
      >
        <Wordmark />
        <h1
          style={{
            marginTop: 64,
            fontSize: 44,
            fontWeight: 800,
            lineHeight: 1.1,
            color: "var(--text-primary)",
            maxWidth: 560,
          }}
        >
          Your automation runs whether you are here or not.
        </h1>
        <p style={{ marginTop: 20, fontSize: 15, color: "var(--text-secondary)", maxWidth: 380 }}>
          Log in to see what ran while you were away and build the next one.
        </p>
        <div style={{ marginTop: 48 }}>
          {PROOF.map((item, i) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: i === 0 ? 0 : 16,
              }}
            >
              <Check size={14} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form column - full width on mobile */}
      <div className="flex w-full flex-col justify-center p-8 md:p-16 md:w-[45%]">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden" style={{ marginBottom: 40 }}>
            <Wordmark />
          </div>

          {reason === "expired" && (
            <div
              style={{
                marginBottom: 20,
                backgroundColor: "var(--state-info-bg)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                fontSize: 14,
                color: "var(--state-info)",
              }}
            >
              Your session ended due to inactivity. Please sign in again.
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Welcome back
          </div>
          <h2 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label
                htmlFor="email"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@business.co.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-green)";
                  e.currentTarget.style.boxShadow = "var(--shadow-focus)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 20 }}>
              <label
                htmlFor="password"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-green)";
                    e.currentTarget.style.boxShadow = "var(--shadow-focus)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
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
              <div style={{ textAlign: "right" }}>
                <Link to="/reset-password" style={{ fontSize: 13, color: "var(--accent-green)" }}>
                  Forgot password
                </Link>
              </div>
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
              disabled={busy || locked}
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
              {busy ? <Loader2 size={18} className="animate-spin" /> : "Sign in"}
            </button>

            {locked && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                You can try again in {lockMinutes} minute{lockMinutes === 1 ? "" : "s"}.
              </p>
            )}

            {!locked && failures >= 3 && (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                Too many attempts will temporarily lock this email.
              </p>
            )}

            {/* Sign up link */}
            <div
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              Don't have an account?{" "}
              <Link
                to="/signup"
                style={{ color: "var(--accent-green)", textDecoration: "none", fontWeight: 600 }}
              >
                Create one
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
                                                           }
                           
