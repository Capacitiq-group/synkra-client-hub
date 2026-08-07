// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { sanitizeEmail, isValidEmail, sanitizeInput } from "@/lib/sanitize";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — Synkra Client Portal" },
      { name: "description", content: "Sign up for a Synkra client portal account." },
      { property: "og:title", content: "Create account — Synkra Client Portal" },
      { property: "og:description", content: "Sign up for a Synkra client portal account." },
    ],
  }),
  component: SignUpPage,
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

function SignUpPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = sanitizeEmail(sanitizeInput(email));
    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }

    setBusy(true);
    try {
      await register(cleanEmail, password, {
        name: name.trim(),
        business_name: businessName.trim(),
      });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create account.";
      if (/already exists/i.test(msg)) {
        setError("An account with this email already exists.");
      } else if (/rate_limited/i.test(msg)) {
        setError("Too many attempts. Please wait a few minutes.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen text-left" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left editorial column */}
      <div
        className="hidden flex-col justify-center border-r md:flex"
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
          Start automating in minutes.
        </h1>
        <p style={{ marginTop: 20, fontSize: 15, color: "var(--text-secondary)", maxWidth: 380 }}>
          Join beta users who are already saving hours every week with ready-to-run workflows.
        </p>
        <div style={{ marginTop: 48 }}>
          {[
            "Five ready-to-use automation templates",
            "Email automation with no API costs",
            "Full activity log for every run",
          ].map((item, i) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: i === 0 ? 0 : 16,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-green)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Form column */}
      <div className="flex w-full flex-col justify-center p-8 md:p-16" style={{ flexBasis: "45%" }}>
        <div className="w-full max-w-sm">
          <div className="md:hidden" style={{ marginBottom: 40 }}>
            <Wordmark />
          </div>

          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Get started
          </div>
          <h2 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
            Create your account
          </h2>

          <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label
                htmlFor="name"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
              >
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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

            <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
              <label
                htmlFor="businessName"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
              >
                Business name
              </label>
              <input
                id="businessName"
                type="text"
                autoComplete="organization"
                placeholder="Your business (optional)"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
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

            <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
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

            <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
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
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
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
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
              <label
                htmlFor="confirmPassword"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                border: "none",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : "Create account"}
            </button>

            <div
              style={{
                marginTop: 20,
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "var(--accent-green)", textDecoration: "none", fontWeight: 600 }}
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
          }
