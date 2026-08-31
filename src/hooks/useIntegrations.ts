import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";

export type IntegrationRecord = {
  id: string;
  status?: string;
  error_message?: string;
  connected_email?: string;
  /** Slack and Zoho Books store the workspace/organization name here; HubSpot the portal name. */
  display_name?: string;
  /**
   * OAuth scopes actually granted on this connection, as reported by
   * Nango at /status time (see nango_client.extract_granted_scopes on
   * the backend). Used to gate workflow blocks that need a specific
   * scope — see lib/workflow/scopes.ts.
   */
  scopes?: string[];
  /**
   * Section 6 (28 Aug 2026) - per-automation opt-in for the Zoho
   * background jobs. Missing/undefined means disabled - connecting Zoho
   * must never silently start any of these running against someone's
   * real customer data. Only an explicit true turns one on - see
   * scheduled/scheduler.py and routers/zoho_webhook.py on the backend,
   * which apply this exact same "missing/null/false = disabled" rule.
   */
  zoho_cashflow_digest_enabled?: boolean;
  zoho_churn_detector_enabled?: boolean;
  zoho_contact_dedupe_enabled?: boolean;
};

/**
 * Map of integration type ("slack", "hubspot", ...) -> its record for
 * the current user, or {} if none are connected yet / still loading.
 * Single source of truth so the integrations settings page and the
 * workflow builder's block gating never drift out of sync on shape.
 */
export function useIntegrationsMap() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["integrations", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return {} as Record<string, IntegrationRecord>;
      const records = await pb
        .collection("integrations")
        .getFullList({ filter: pb.filter("user_id = {:userId}", { userId: user.id }) });
      return Object.fromEntries(records.map((record) => [record["type"], record])) as Record<
        string,
        IntegrationRecord
      >;
    },
  });
}
