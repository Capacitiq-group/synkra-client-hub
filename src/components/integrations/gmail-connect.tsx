import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "https://api.synkra.co.za";

/**
 * Gmail is the one integration whose OAuth flow is a plain
 * backend-brokered redirect (routers/integrations_gmail.py's /connect +
 * /callback) rather than a Nango-brokered popup like every other
 * integration here — see integration-directory.tsx's `connect()`, which
 * is intentionally dead/Nango-only past its paid-plan check and exists
 * only as a "fails loudly, not silently" placeholder for exactly this
 * case. This is a full-page navigation: the backend signs its own state
 * param, redirects to Google, and on return redirects back to
 * /dashboard/settings?tab=integrations&connected=gmail (or
 * &error=gmail_*), which dashboard.settings.tsx already forwards to
 * /dashboard/integrations, where the generic ?connected=<key> toast
 * (integration-directory.tsx) picks it up — no extra wiring needed there.
 */
export function GmailConnectButton({ label = "Connect" }: { label?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const connect = () => {
    const url = `${API_BASE}/integrations/gmail/connect?user_id=${encodeURIComponent(user.id)}`;
    window.location.href = url;
  };

  return <Button onClick={connect}>{label}</Button>;
}
