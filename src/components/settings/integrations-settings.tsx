import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { disconnectIntegration, integrationConnectUrl, testIntegration } from "@/lib/workflow/api";
import { SettingsSection } from "./settings-primitives";

type IntegrationRecord = {
  id: string;
  status?: string;
  error_message?: string;
  connected_email?: string;
};

type Service = {
  key: string;
  name: string;
  description: string;
  /** Lucide icon for first-party (Synkra) rows only. */
  icon?: typeof Mail;
  iconColor?: string;
  iconBg?: string;
  /**
   * Official hosted logo for third-party platforms. Standing rule: use the real
   * hosted logo image, never an icon component, and give it a background that
   * keeps the brand's own colours legible in both light and dark mode.
   */
  logoUrl?: string;
  /** Background painted behind the logo inside the fixed-size container. */
  logoBg?: string;
  comingSoon?: boolean;
  tooltip?: string;
  endpoint?: "hubspot";
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
    key: "hubspot",
    name: "HubSpot",
    description:
      "Automatically follow up, escalate, and personalise outreach based on deals and contacts in your HubSpot CRM.",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787420665/HubSpot-Logo_xqgtan.png",
    // HubSpot's mark is charcoal + orange, so it needs a light neutral chip to
    // stay legible and true to brand on a dark background.
    logoBg: "#F5F5F3",
    endpoint: "hubspot",
  },
];

export function IntegrationsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const { connected: connectedParam } = useSearch({ from: "/dashboard/settings" });
  const navigate = useNavigate();
  useEffect(() => {
    if (!connectedParam) return;
    const service = SERVICES.find((item) => item.key === connectedParam);
    toast.success(`${service?.name ?? connectedParam} connected`);
    void queryClient.invalidateQueries({ queryKey: ["integrations", user?.id] });
    void navigate({ to: "/dashboard/settings", search: { tab: "integrations" }, replace: true });
  }, [connectedParam, navigate, queryClient, user?.id]);
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
                ? record?.connected_email
                  ? `Connected as: ${record.connected_email}`
                  : "Connected"
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
                  {/* Fixed-size logo container so every row lines up evenly,
                      whatever shape the individual logo has. */}
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full p-2"
                    style={{ backgroundColor: service.logoBg ?? service.iconBg }}
                  >
                    {service.logoUrl ? (
                      <img
                        src={service.logoUrl}
                        alt={`${service.name} logo`}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : Icon ? (
                      <Icon size={21} style={{ color: service.iconColor }} />
                    ) : null}
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
                        ? `Emails are sent from ${(user.business_name || "your-business").toLowerCase().replace(/[^a-z0-9]+/g, "-")}@synkra.co.za on your behalf.`
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
                    <Button variant="secondary" onClick={() => connect(service)}>
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
    </>
  );
    }
