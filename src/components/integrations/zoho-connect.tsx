import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { createZohoConnectSession, createReauthorizeSession, fetchZohoStatus } from "@/lib/workflow/api";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { confirmConnectionWithRetry } from "@/lib/workflow/connect-retry";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";

// Same two self-hosted Nango hosts as Slack (see slack-connect.tsx and
// nango-integration-architecture.md for why these are deliberately two
// different hosts, not a copy-paste mistake).
const NANGO_HOST = "https://nango.synkra.co.za";
const NANGO_CONNECT_HOST = "https://connect.synkra.co.za";

/**
 * Zoho Books connect flow — identical shape to useSlackConnect/
 * useHubspotConnect. Kept as its own copy rather than a shared generic
 * hook, same call the other two components already made — worth
 * extracting once a fourth platform needs this exact shape.
 *
 * `additionalScopes`, when given, switches this into the reauthorize
 * flow instead of a fresh connect — same pattern as
 * useHubspotConnect in hubspot-connect.tsx.
 */
export function useZohoConnect(onConnected?: () => void, additionalScopes?: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const isReauthorize = Boolean(additionalScopes?.length);

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
      // See hubspot-connect.tsx: a reauthorize only widens scopes on a
      // connection already paid for, so the paid-plan gate only applies
      // to a fresh connection.
      if (!isReauthorize) {
        const decision = (await checkIntegrationConnectFn({ data: { token } })) as unknown as {
          ok: boolean;
          message?: string;
        };
        if (!decision.ok) {
          toast.error(decision.message || INTEGRATIONS_PAID_PLAN_NOTE);
          setConnecting(false);
          return;
        }
      }

      const sessionToken = isReauthorize
        ? await createReauthorizeSession("zoho", user.id, additionalScopes!)
        : await createZohoConnectSession(user.id);

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
                const status = await confirmConnectionWithRetry(() => fetchZohoStatus(user.id));
                await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
                await queryClient.invalidateQueries({ queryKey: ["zoho-status", user.id] });
                if (status.connected) {
                  toast.success(
                    isReauthorize
                      ? "Zoho Books permissions updated"
                      : status.organization_name
                        ? `Zoho Books connected — ${status.organization_name}`
                        : "Zoho Books connected",
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
      toast.error(
        isReauthorize
          ? "Could not start the Zoho Books reauthorization. Please try again."
          : "Could not start the Zoho Books connection. Please try again.",
      );
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

/**
 * "This needs more permissions" prompt — shown by the workflow config
 * panel when a block's requiredScopes aren't all present on the
 * connection yet. Mirrors HubspotReauthorizeButton exactly.
 */
export function ZohoReauthorizeButton({
  missingScopes,
  onConnected,
}: {
  missingScopes: string[];
  onConnected?: () => void;
}) {
  const { start, connecting, canConnect } = useZohoConnect(onConnected, missingScopes);
  return (
    <Button variant="secondary" disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Requesting access…" : "Reauthorize to grant access"}
    </Button>
  );
}
