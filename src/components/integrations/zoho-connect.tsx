import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { createZohoConnectSession, fetchZohoStatus } from "@/lib/workflow/api";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";

// Same two self-hosted Nango hosts as Slack (see slack-connect.tsx and
// nango-integration-architecture.md for why these are deliberately two
// different hosts, not a copy-paste mistake).
const NANGO_HOST = "https://nango.synkra.co.za";
const NANGO_CONNECT_HOST = "https://connect.synkra.co.za";

/**
 * Zoho Books connect flow — identical shape to useSlackConnect. Kept as
 * its own copy rather than a shared generic hook for now, same call the
 * Slack component already made (see its comments) — worth extracting
 * once a third platform needs this exact shape.
 */
export function useZohoConnect(onConnected?: () => void) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const start = async () => {
    if (!user) return;
    if (connecting) return;
    const token = pb.authStore.token;
    if (!token) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    setConnecting(true);
    try {
      const decision = (await checkIntegrationConnectFn({ data: { token } })) as unknown as {
        ok: boolean;
        message?: string;
      };
      if (!decision.ok) {
        toast.error(decision.message || INTEGRATIONS_PAID_PLAN_NOTE);
        setConnecting(false);
        return;
      }

      const sessionToken = await createZohoConnectSession(user.id);
      const nango = new Nango({ host: NANGO_HOST });
      const connect = nango.openConnectUI({
        // See slack-connect.tsx: openConnectUI() never reads the
        // constructor's `host` — baseURL/apiURL must both be passed
        // explicitly here too, or this silently talks to Nango's
        // public cloud instead of our self-hosted instance.
        baseURL: NANGO_CONNECT_HOST,
        apiURL: NANGO_HOST,
        onEvent: (event) => {
          // Full-popup-lifetime "connecting" state — see slack-connect.tsx
          // for why resetting this early caused the double-session bug.
          if (event.type === "close" || event.type === "error") {
            setConnecting(false);
          }
          if (event.type === "connect") {
            void (async () => {
              try {
                const status = await fetchZohoStatus(user.id);
                await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
                await queryClient.invalidateQueries({ queryKey: ["zoho-status", user.id] });
                if (status.connected) {
                  toast.success(
                    status.organization_name ? `Zoho Books connected — ${status.organization_name}` : "Zoho Books connected",
                  );
                } else {
                  toast.error("Zoho Books did not report a connection. Please try again.");
                }
                onConnected?.();
              } catch {
                toast.error("Zoho Books connected, but we could not confirm it. Please refresh.");
              } finally {
                setConnecting(false);
              }
            })();
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } catch {
      toast.error("Could not start the Zoho Books connection. Please try again.");
      setConnecting(false);
    }
  };

  return { start, connecting, canConnect: Boolean(user) };
}

export function ZohoConnectButton({
  label = "Connect",
  onConnected,
}: {
  label?: string;
  onConnected?: () => void;
}) {
  const { start, connecting, canConnect } = useZohoConnect(onConnected);
  return (
    <Button disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Opening Zoho Books…" : label}
    </Button>
  );
}
