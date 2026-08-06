import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Mail, MessageCircle, Smartphone, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { disconnectIntegration, integrationConnectUrl, testIntegration } from "@/lib/workflow/api";
import { SettingsSection } from "./settings-primitives";

type IntegrationRecord = { id: string; status?: string; error_message?: string };
type Service = {
  key: string;
  name: string;
  description: string;
  icon: typeof Mail;
  iconColor: string;
  iconBg: string;
  comingSoon?: boolean;
  tooltip?: string;
  endpoint?: "google-calendar" | "google-sheets";
};
const SERVICES: Service[] = [
  {
    key: "email",
    name: "Email sending",
    description: "Platform email delivery for your workflows.",
    icon: Mail,
    iconColor: "var(--text-primary)",
    iconBg: "var(--bg-primary)",
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    description:
      "Connect your WhatsApp Business account to send and receive messages automatically.",
    icon: MessageCircle,
    iconColor: "#25D366",
    iconBg: "var(--bg-primary)",
    comingSoon: true,
    tooltip: "WhatsApp automation launches in September 2026",
  },
  {
    key: "google_calendar",
    name: "Google Calendar",
    description: "Create calendar events and check availability from your workflows.",
    icon: Calendar,
    iconColor: "var(--state-info)",
    iconBg: "var(--text-primary)",
    endpoint: "google-calendar",
  },
  {
    key: "google_sheets",
    name: "Google Sheets",
    description: "Add rows, read data, and update spreadsheets from your workflows.",
    icon: Table2,
    iconColor: "var(--state-success)",
    iconBg: "var(--text-primary)",
    endpoint: "google-sheets",
  },
  {
    key: "twilio_sms",
    name: "SMS",
    description: "Send SMS messages to customers from your automations.",
    icon: Smartphone,
    iconColor: "var(--state-error)",
    iconBg: "var(--bg-primary)",
    comingSoon: true,
    tooltip: "SMS automation launches in September 2026",
  },
];

export function IntegrationsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Service | null>(null);
  const query = useQuery({
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
  if (!user) return null;
  const connect = (service: Service) => {
    if (service.endpoint) window.location.assign(integrationConnectUrl(service.endpoint, user.id));
  };
  const test = async (service: Service) => {
    try {
      await testIntegration(service.key, user.id);
      toast.success("Connection is working");
    } catch {
      toast.error("Connection test failed");
    }
  };
  const disconnect = async (service: Service) => {
    try {
      await disconnectIntegration(service.key, user.id);
      await queryClient.invalidateQueries({ queryKey: ["integrations", user.id] });
      toast.success(`${service.name} disconnected`);
    } catch {
      toast.error("Could not disconnect integration");
    }
  };
  return (
    <>
      <SettingsSection title="Connected tools">
        <p className="mb-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Connect external services to power your automations. Each connection is used automatically
          by any workflow that requires it.
        </p>
        <div className="flex flex-col gap-3">
          {SERVICES.map((service) => {
            const record = query.data?.[service.key];
            const connected = service.key === "email" || record?.status === "connected";
            const status = service.comingSoon
              ? "Coming soon"
              : connected
                ? "Connected"
                : record?.status === "error"
                  ? "Error"
                  : "Disconnected";
            const Icon = service.icon;
            return (
              <article
                key={service.key}
                className="flex flex-col gap-4 border p-5 sm:flex-row sm:items-center"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: service.iconBg }}
                  >
                    <Icon size={21} style={{ color: service.iconColor }} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{service.name}</h3>
                    <p
                      className="mt-1 text-[13px]"
                      style={{
                        color: service.comingSoon
                          ? "var(--state-warning)"
                          : connected
                            ? "var(--state-success)"
                            : record?.status === "error"
                              ? "var(--state-error)"
                              : "var(--text-muted)",
                      }}
                    >
                      {status}
                    </p>
                    {record?.status === "error" && record.error_message && (
                      <p className="mt-1 text-xs" style={{ color: "var(--state-error)" }}>
                        {record.error_message}
                      </p>
                    )}
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {service.key === "email"
                        ? `Emails are sent from ${(user.business_name || "your-business").toLowerCase().replace(/[^a-z0-9]+/g, "-")}@synkra-notifications.co.za on your behalf.`
                        : service.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {service.key === "email" ? (
                    <span
                      className="flex items-center gap-1 text-[13px]"
                      style={{ color: "var(--state-success)" }}
                    >
                      <CheckCircle size={14} />
                      Active
                    </span>
                  ) : service.comingSoon ? (
                    <Button disabled title={service.tooltip}>
                      Coming soon
                    </Button>
                  ) : connected ? (
                    <>
                      <Button variant="link" size="sm" onClick={() => void test(service)}>
                        Test connection
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: "var(--state-error)" }}
                        onClick={() => void disconnect(service)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setConfirm(service)}>
                      Connect
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SettingsSection>
      <p className="mt-3 text-left" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Your notification email address is configured in the Notifications tab.
      </p>
      {confirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md border p-6"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <h2 className="text-lg font-semibold">Connect {confirm.name}</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Synkra will be able to create and read{" "}
              {confirm.key === "google_calendar" ? "calendar events" : "spreadsheet data"} on your
              behalf. We do not read or modify existing data without your workflow specifically
              requesting it.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button onClick={() => connect(confirm)}>Connect with Google</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
