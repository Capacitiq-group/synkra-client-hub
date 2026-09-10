import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

/**
 * Gmail is the one integration whose OAuth flow is a plain
 * backend-brokered redirect (routers/integrations_gmail.py's /connect +
 * /callback) rather than a Nango-brokered popup like every other
 * integration here — see integration-directory.tsx's `connect()`, which
 * is intentionally dead/Nango-only past its paid-plan check and exists
 * only as a "fails loudly, not silently" placeholder for exactly this
 * case.
 *
 * /connect is now POST + a real auth token (see integrations_gmail.py) —
 * it used to be a plain GET with `user_id` as a query param, which meant
 * anyone could request a connect URL for an arbitrary user_id and link
 * their OWN Gmail to someone else's account. So this can no longer be a
 * single window.location.href like before: it does an authenticated
 * fetch first to get the real Google URL, then navigates to it. The
 * backend still redirects back to
 * /dashboard/settings?tab=integrations&connected=gmail (or
 * &error=gmail_*) on return, which dashboard.settings.tsx already
 * forwards to /dashboard/integrations, where the generic ?connected=<key>
 * toast (integration-directory.tsx) picks it up — no extra wiring needed
 * there.
 */
export function GmailConnectButton({ label = "Connect" }: { label?: string }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const token = pb.authStore.token;
      if (!token) {
        setError("Your session has expired. Please sign in again.");
        return;
      }
      const response = await fetch(`${API_BASE}/integrations/gmail/connect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setError("Could not start the Gmail connection. Please try again.");
        return;
      }
      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        setError("Could not start the Gmail connection. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start the Gmail connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={() => void connect()} disabled={busy}>
        {busy && <Loader2 size={14} className="mr-1.5 animate-spin" />}
        {label}
      </Button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--state-error)" }} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
