// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { runFirstTimeSetup } from "@/lib/setup/createCollections";
import { isValidEmail, sanitizeEmail, sanitizeInput } from "@/lib/sanitize";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First time setup — Synkra Client Portal" },
      {
        name: "description",
        content: "Create the PocketBase collections and seed the starter automation templates.",
      },
      { property: "og:title", content: "First time setup — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Create the PocketBase collections and seed the starter automation templates.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
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

function SetupPage() {
  const navigate = useNavigate();
  const defaultUrl = (import.meta.env["VITE_POCKETBASE_URL"] as string | undefined) ?? "";

  const [pbUrl, setPbUrl] = useState(defaultUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSteps([]);

    const url = sanitizeInput(pbUrl);
    const cleanEmail = sanitizeEmail(sanitizeInput(email));
    if (!/^https?:\/\//.test(url)) {
      setError("Enter the full PocketBase URL including https://");
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid admin email address.");
      return;
    }

    setBusy(true);
    await runFirstTimeSetup(url, cleanEmail, password, {
      onStep: (message) => setSteps((prev) => [...prev, message]),
      onComplete: () => setDone(true),
      onError: (message) => setError(message),
    });
    setBusy(false);
    setPassword("");
  }

  return (
    <div
      className="flex min-h-screen justify-center px-6 py-24 text-left"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div
          style={{ color: "var(--accent-green)", fontSize: 20, fontWeight: 800, letterSpacing: "0.1em" }}
        >
          SYNKRA
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          First time setup
        </div>
        <h1 style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
          Prepare your PocketBase instance
        </h1>
        <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
          Sign in with your PocketBase superuser account. This creates the collections the portal
          needs and seeds the five starter templates. Running it again changes nothing that already
          exists. Your credentials are used once in the browser and are never stored.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 32, display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="pb-url" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              PocketBase URL
            </label>
            <input
              id="pb-url"
              value={pbUrl}
              onChange={(e) => setPbUrl(e.target.value)}
              placeholder="https://pb.synkra.co.za"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="pb-email" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              Superuser email
            </label>
            <input
              id="pb-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="pb-password" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
              Superuser password
            </label>
            <input
              id="pb-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
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
            {busy ? <Loader2 size={18} className="animate-spin" /> : "Run setup"}
          </button>
        </form>

        {steps.length > 0 && (
          <div style={{ marginTop: 32, display: "grid", gap: 10 }}>
            {steps.map((step, i) => (
              <div key={`${step}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={14} style={{ color: "var(--accent-green)" }} />
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {done && (
          <button
            type="button"
            onClick={() => navigate({ to: "/login" })}
            className="transition-colors"
            style={{
              marginTop: 24,
              height: 48,
              width: "100%",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              fontSize: 15,
              color: "var(--text-secondary)",
            }}
          >
            Go to sign in
          </button>
        )}
      </div>
    </div>
  );
}
