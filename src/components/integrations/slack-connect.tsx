import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { createSlackConnectSession, fetchSlackStatus } from "@/lib/workflow/api";
import { checkIntegrationConnectFn } from "@/lib/usage/usage.functions";
import { INTEGRATIONS_PAID_PLAN_NOTE } from "@/lib/plans";

const NANGO_HOST = "https://nango.synkra.co.za";

/**
 * Shared Slack connect flow, used by both the integrations directory card and
 * the workflow builder's channel picker.
 *
 * Flow: our backend issues a Nango Connect session token -> the Nango popup
 * runs the Slack OAuth -> on "connect" we POST /integrations/slack/status,
 * which is what actually saves the `integrations` record server-side -> we
 * invalidate the integrations queries so the UI flips to "Connected".
 *
 * The paid-plan gate is unchanged: connecting any external platform is a paid
 * feature, and the server (not the client tier) makes that decision.
 */
export function useSlackConnect(onConnected?: () => void) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const start = async () => {
    if (!user) return;
    // Guard against a second tap while a popup/session is already in flight —
    // this is what previously let two Connect sessions get created for the
    // same user_id within seconds of each other, which invalidates the first
    // popup mid-flow and surfaces Nango's "Your session has expired" error.
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

      const sessionToken = await createSlackConnectSession(user.id);
      const nango = new Nango({ host: NANGO_HOST });
      const connect = nango.openConnectUI({
        onEvent: (event) => {
          // Keep the button disabled for the *whole* popup lifetime, not just
          // until the token handoff — otherwise it re-enables while the user
          // is still mid-flow in the popup, and a second tap creates a
          // competing Connect session for the same user_id that invalidates
          // the first one.
          if (event.type === "close" || event.type === "error") {
            setConnecting(false);
          }
          if (event.type === "connect") {
            void (async () => {
              try {
                const status = await fetchSlackStatus(user.id);
                await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
                await queryClient.invalidateQueries({ queryKey: ["slack-status", user.id] });
                await queryClient.invalidateQueries({ queryKey: ["slack-channels", user.id] });
                if (status.connected) {
                  toast.success(
                    status.team_name ? `Slack connected — ${status.team_name}` : "Slack connected",
                  );
                } else {
                  toast.error("Slack did not report a connection. Please try again.");
                }
                onConnected?.();
              } catch {
                toast.error("Slack connected, but we could not confirm it. Please refresh.");
              } finally {
                setConnecting(false);
              }
            })();
          }
        },
      });
      connect.setSessionToken(sessionToken);
    } catch {
      toast.error("Could not start the Slack connection. Please try again.");
      setConnecting(false);
    }
  };

  return { start, connecting, canConnect: Boolean(user) };
}

export function SlackConnectButton({
  label = "Connect",
  onConnected,
}: {
  label?: string;
  onConnected?: () => void;
}) {
  const { start, connecting, canConnect } = useSlackConnect(onConnected);
  return (
    <Button disabled={!canConnect || connecting} onClick={() => void start()}>
      {connecting ? "Opening Slack…" : label}
    </Button>
  );
}
