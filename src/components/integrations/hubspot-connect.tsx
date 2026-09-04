import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import {
  createHubspotConnectSession,
  createReauthorizeSession,
  fetchHubspotStatus,
} from "@/lib/workflow/api";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { confirmConnectionWithRetry } from "@/lib/workflow/connect-retry";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";

// Same two-host split as slack-connect.tsx — see that file's comments for
// the full postmortem on why both baseURL and apiURL must be set
// explicitly, and why they must be two different hosts.
const NANGO_HOST = "https://nango.synkra.co.za";
const NANGO_CONNECT_HOST = "https://connect.synkra.co.za";

/**
 * HubSpot connect flow, deliberately a near-duplicate of
 * useSlackConnect() in slack-connect.tsx rather than a shared
 * abstraction — that flow took a long debugging session to get right
 * (double-session race, wrong Connect UI host, X-Frame-Options), and
 * copying its exact proven shape here is lower-risk than refactoring
 * both onto one abstraction while it's still fresh.
 *
 * `additionalScopes`, when given, switches this into the reauthorize
 * flow instead of a fresh connect — used when a workflow block needs a
 * scope the existing connection doesn't have yet (see
 * docs/integrations/scopes-and-custom-workflows.md). Reauthorizing
 * updates the same connection in place; it does not create a second one.
 */
export function useHubspotConnect(onConnected?: () => void, additionalScopes?: string[]) {
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
      // The paid-plan gate only applies to a fresh connection — a
      // reauthorize is just widening scopes on a connection the user
      // already paid to create, so re-checking plan eligibility here
      // would be a confusing extra hurdle for something that isn't a
      // new purchase decision.
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
        ? await createReauthorizeSession("hubspot", user.id, additionalScopes!)
        : await createHubspotConnectSession(user.id);

      const nango = new Nango({ host: NANGO_HOST });
      const connect = nango.openConnectUI({
        baseURL: NANGO_CONNECT_HOST,
        apiURL: NANGO_HOST,
        onEvent: (event) => {
          if (event.type === "close" || event.type === "error") {
            setConnecting(false);
          }
          if (event.type === "connect") {
            void (async () => {
              try {
                const status = await confirmConnectionWithRetry(() => fetchHubspotStatus(user.id));
                await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
                if (status.connected) {
                  toast.success(isReauthorize ? "HubSpot permissions updated" : "HubSpot connected");
                } else {
                  toast.error("HubSpot did not report a connection. Please try again.");
                }
                onConnected?.();
              } catch {
                toast.error("HubSpot connected, but we could not confirm it. Please refresh.");
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
          ? "Could not start the HubSpot reauthorization. Please try again."
          : "Could not start the HubSpot connection. Please try again.",
      );
      setConnecting(false);
    }
  };

  return { start, connecting, canConnect: Boolean(user) };
}

export function HubspotConnectButton({
  label = "Connect",
  onConnected,
}: {
  label?: string;
  onConnected?: () => void;
}) {
  const { start, connecting, canConnect } = useHubspotConnect(onConnected);
  return (
    <Button disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Opening HubSpot…" : label}
    </Button>
  );
}

/**
 * "This needs more permissions" prompt — shown by the workflow config
 * panel when a block's requiredScopes aren't all present on the
 * connection yet (see lib/workflow/scopes.ts's missingScopes()).
 */
export function HubspotReauthorizeButton({
  missingScopes,
  onConnected,
}: {
  missingScopes: string[];
  onConnected?: () => void;
}) {
  const { start, connecting, canConnect } = useHubspotConnect(onConnected, missingScopes);
  return (
    <Button variant="secondary" disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Requesting access…" : "Reauthorize to grant access"}
    </Button>
  );
}
