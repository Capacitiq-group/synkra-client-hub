import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Mail } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { inboundEmailAddressForUser } from "@/lib/workflow/api";

/**
 * Shared "forwarding address" card.
 *
 * Every account already has a dedicated inbound address — it is derived from
 * the account id (flow-<user id>@in.synkra.co.za), so there is nothing to
 * create or configure. This card is the single place that renders it, so the
 * address looks the same on the workflow builder's "Email received" trigger,
 * the integrations directory and account settings.
 */
export function useForwardingAddress() {
  const { user } = useAuth();
  const address = user?.id ? inboundEmailAddressForUser(user.id) : null;

  const verification = useQuery({
    queryKey: ["inbound-address", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const records = await pb.collection("inbound_addresses").getFullList({
          filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        });
        const record = records[0];
        return record ? { verified: Boolean(record["verified"]) } : null;
      } catch {
        // The collection may not be readable/available yet — never block setup.
        return null;
      }
    },
    staleTime: 30000,
  });

  return {
    address,
    verified: Boolean(verification.data?.verified),
    statusKnown: verification.isSuccess,
  };
}

export function ForwardingAddressCard({
  title = "Your forwarding address",
  description = "Every account has one. Forward emails here from Gmail or Outlook and they can start a workflow.",
  showHeader = true,
  showSetupNote = true,
  className = "",
}: {
  title?: string;
  description?: string;
  showHeader?: boolean;
  showSetupNote?: boolean;
  className?: string;
}) {
  const { address, verified, statusKnown } = useForwardingAddress();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-2">
          <Mail size={14} aria-hidden="true" style={{ color: "var(--accent-green)" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            {title}
          </span>
        </div>
      )}

      {address ? (
        <>
          <div
            className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
            style={{
              border: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-card)",
            }}
          >
            <code style={{ fontSize: 12, color: "var(--text-primary)" }}>{address}</code>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy forwarding address"
              className="synkra-focus flex items-center gap-1 rounded-sm"
              style={{ fontSize: 12, color: "var(--accent-green)" }}
            >
              {copied ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {description && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</p>
          )}

          {showSetupNote && (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              In Gmail: Settings → Forwarding and POP/IMAP → Add a forwarding address, or create a
              filter that forwards matching mail here. In Outlook: Settings → Mail → Forwarding, or
              an inbox rule. The first time you set this up your provider asks you to confirm the
              address — we detect and confirm that automatically when possible.
            </p>
          )}

          {verified ? (
            <p style={{ fontSize: 12, color: "var(--state-success)" }}>
              Verified — forwarded emails will start your workflows.
            </p>
          ) : statusKnown ? (
            <p style={{ fontSize: 12, color: "var(--state-warning)" }}>
              Not verified yet — send a test forwarded email to complete setup.
            </p>
          ) : null}
        </>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Sign in to see your forwarding address.
        </p>
      )}
    </div>
  );
}

export default ForwardingAddressCard;
