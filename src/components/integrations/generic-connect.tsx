import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import {
  createProviderConnectSession,
  createReauthorizeSession,
  fetchProviderStatus,
} from "@/lib/workflow/api";
import { confirmConnectionWithRetry } from "@/lib/workflow/connect-retry";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";
import { findIntegration } from "@/lib/integrations/catalog";

// Same two-host split as slack-connect.tsx/hubspot-connect.tsx — see
// those files for the full postmortem on why both baseURL and apiURL
// must be set explicitly, and why they must be two different hosts.
const NANGO_HOST = "https://nango.synkra.co.za";
const NANGO_CONNECT_HOST = "https://connect.synkra.co.za";

/**
 * Parametrized version of useHubspotConnect()/useSlackConnect() for the 8
 * OAuth launch integrations (everything routed through
 * oauth_integration_factory.py server-side: Shopify, Typeform, Calendly,
 * Xero, Airtable, Monday.com, Asana, Pipedrive). Deliberately built once,
 * shared — unlike HubSpot/Slack it doesn't have a debugging history to
 * protect, and 8 more hand-copies of the same ~100 lines is a worse
 * trade than one parametrized hook. Tally is intentionally NOT covered
 * here — it isn't OAuth, see tally-connect.tsx.
 *
 * `additionalScopes`, when given, switches this into the reauthorize
 * flow instead of a fresh connect — used when a workflow block needs a
 * scope the existing connection doesn't have yet. Same semantics as
 * every other provider's reauthorize: it updates the same connection in
 * place, it does not create a second one.
 */
export function useGenericConnect(
  providerKey: string,
  displayName: string,
  onConnected?: () => void,
  additionalScopes?: string[],
) {
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
      // See hubspot-connect.tsx: the paid-plan gate only applies to a
      // fresh connection, not a reauthorize widening scopes on a
      // connection already paid for.
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
        ? await createReauthorizeSession(providerKey, user.id, additionalScopes!)
        : await createProviderConnectSession(providerKey, user.id);

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
                // Same race condition documented in connect-retry.ts's
                // docstring — Nango's "connect" event can fire slightly
                // before the connection is queryable via its REST API.
                // This matters even more for a reauthorize than a fresh
                // connect: if the retry gives up too early here, the
                // widened-scope status never gets written, and the
                // config panel keeps showing "needs more permissions"
                // even though the user just granted them.
                const status = await confirmConnectionWithRetry(() => fetchProviderStatus(providerKey, user.id));
                await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
                if (status.connected) {
                  toast.success(isReauthorize ? `${displayName} permissions updated` : `${displayName} connected`);
                } else {
                  toast.error(`${displayName} did not report a connection. Please try again.`);
                }
                onConnected?.();
              } catch {
                toast.error(`${displayName} connected, but we could not confirm it. Please refresh.`);
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
          ? `Could not start the ${displayName} reauthorization. Please try again.`
          : `Could not start the ${displayName} connection. Please try again.`,
      );
      setConnecting(false);
    }
  };

  return { start, connecting, canConnect: Boolean(user) };
}

export function GenericConnectButton({
  providerKey,
  label = "Connect",
  onConnected,
}: {
  providerKey: string;
  label?: string;
  onConnected?: () => void;
}) {
  const displayName = findIntegration(providerKey)?.name ?? providerKey;
  const { start, connecting, canConnect } = useGenericConnect(providerKey, displayName, onConnected);
  return (
    <Button disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? `Opening ${displayName}…` : label}
    </Button>
  );
}

/**
 * "This needs more permissions" prompt — shown by the workflow config
 * panel when a block's requiredScopes aren't all present on the
 * connection yet (see lib/workflow/scopes.ts's missingScopes()).
 */
export function GenericReauthorizeButton({
  providerKey,
  missingScopes,
  onConnected,
}: {
  providerKey: string;
  missingScopes: string[];
  onConnected?: () => void;
}) {
  const displayName = findIntegration(providerKey)?.name ?? providerKey;
  const { start, connecting, canConnect } = useGenericConnect(providerKey, displayName, onConnected, missingScopes);
  return (
    <Button variant="secondary" disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Requesting access…" : "Reauthorize to grant access"}
    </Button>
  );
}
