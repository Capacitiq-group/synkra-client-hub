/**
 * Per-automation on/off switches for the three Zoho background jobs.
 * Shown inside the Zoho integration's detail dialog once connected.
 *
 * Opt-in, not opt-out: connecting Zoho must never silently start any of
 * these running against a customer's real data. Missing/undefined means
 * OFF - see scheduled/scheduler.py and routers/zoho_webhook.py on the
 * backend, which apply this exact same rule. A switch with no stored
 * value yet should render as off, and stay off until someone
 * deliberately turns it on.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { updateZohoAutomations, type ZohoAutomationToggles } from "@/lib/workflow/api";
import type { IntegrationRecord } from "@/hooks/useIntegrations";

const AUTOMATIONS: Array<{
  field: keyof ZohoAutomationToggles;
  label: string;
  description: string;
}> = [
  {
    field: "zoho_cashflow_digest_enabled",
    label: "Weekly cash-flow digest",
    description: "A Monday-morning summary of what got paid, what's overdue, and any expense spikes. Off until you turn it on.",
  },
  {
    field: "zoho_churn_detector_enabled",
    label: "Silent churn detection",
    description: "Flags customers with a real declining-order pattern and drafts a personal check-in for your approval. Off until you turn it on.",
  },
  {
    field: "zoho_contact_dedupe_enabled",
    label: "Duplicate contact checks",
    description: "Checks new contacts against your existing list and flags likely duplicates before they cause billing confusion. Off until you turn it on.",
  },
];

export function ZohoAutomationToggles({ record }: { record: IntegrationRecord }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (toggles: ZohoAutomationToggles) => updateZohoAutomations(toggles),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations", user?.id] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not update automation settings.");
    },
  });

  return (
    <div className="space-y-3 border-t pt-3" style={{ borderColor: "var(--border-default)" }}>
      <div>
        <p className="text-[13px] font-semibold">Optional automations</p>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Off by default. Turning one on doesn't send anything automatically — every draft still
          waits for your approval first.
        </p>
      </div>
      {AUTOMATIONS.map(({ field, label, description }) => {
        // Undefined -> disabled, matching the backend's exact rule.
        const checked = record[field] === true;
        return (
          <div key={field} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{label}</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            </div>
            <Switch
              checked={checked}
              disabled={mutation.isPending}
              onCheckedChange={(value) => mutation.mutate({ [field]: value })}
              aria-label={label}
            />
          </div>
        );
      })}
    </div>
  );
}
