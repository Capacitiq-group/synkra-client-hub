/**
 * Integration catalog — SINGLE SOURCE OF TRUTH for the platforms Synkra can
 * work with.
 *
 * Rules for this file:
 * - Every platform the portal knows about is declared exactly once here.
 *   The integrations directory, the workflow "Apps" filter and the paid-plan
 *   gate all read this list, so adding an entry makes it available everywhere
 *   with no other change.
 * - `key` is the value stored on `integrations.type` and referenced by
 *   workflow blocks (`requiresIntegration`) and template
 *   `integrations_required`.
 * - `includedOnEveryPlan` marks capabilities Synkra runs itself (email, AI,
 *   webhooks). They need no OAuth connection and are never plan-locked as an
 *   integration.
 * - `requiresPaidPlan` marks platforms that can only be connected on a paid
 *   plan (see `integrationsAllowed` in @/lib/plans).
 * - `available: false` means "declared but not connectable yet".
 */

import {
  Bot,
  Building2,
  DollarSign,
  Globe,
  Hash,
  Mail,
  MessageCircle,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export const INTEGRATION_CATEGORIES = [
  "Communication",
  "CRM",
  "Messaging",
  "Automation",
  "AI",
  "Finance",
] as const;

export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export interface IntegrationDefinition {
  /** Stored platform key. Also used by workflow blocks and templates. */
  key: string;
  name: string;
  category: IntegrationCategory;
  /** One line for the directory card. */
  summary: string;
  /** Longer explanation for the detail dialog. */
  description: string;
  /** Optional extra facts shown as a bullet list in the detail dialog. */
  notes?: string[];
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  logoUrl?: string;
  logoBg?: string;
  /** OAuth endpoint name, when Synkra brokers the connection itself. */
  endpoint?: "hubspot";
  /** Runs on Synkra's own infrastructure — nothing to connect. */
  includedOnEveryPlan?: boolean;
  /** Connecting this platform needs a paid plan. */
  requiresPaidPlan?: boolean;
  /** False when the platform is declared but not connectable yet. */
  available?: boolean;
  /**
   * Capability that runs inside Synkra and is not something a user connects.
   * It stays available to workflows, templates and the Apps filter, but it is
   * not listed in the integrations directory.
   */
  hiddenFromDirectory?: boolean;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: "email",
    name: "Email",
    category: "Communication",
    summary: "Send and receive email from your workflows. Included on every plan.",
    description:
      "Synkra sends transactional email for you and gives every workspace an inbound address, so email triggers and email actions work without connecting anything.",
    notes: ["Included on every plan", "Inbound address is created with your workspace"],
    icon: Mail,
    iconColor: "var(--accent-green)",
    includedOnEveryPlan: true,
    available: true,
  },
  {
    key: "ai",
    name: "AI",
    category: "AI",
    summary: "Summarise, classify, extract and draft replies inside a workflow.",
    description:
      "AI steps run on Synkra's managed models and consume AI credits from your plan. No API key or external account is required.",
    notes: ["Uses AI credits from your plan"],
    icon: Bot,
    iconColor: "var(--state-info)",
    includedOnEveryPlan: true,
    available: true,
    hiddenFromDirectory: true,
  },
  {
    key: "webhook",
    name: "Webhooks",
    category: "Automation",
    summary: "Start a workflow from any system that can send an HTTP request.",
    description:
      "Every webhook trigger gets its own URL. Paste it into a website form, a booking system or any tool that can post data, and the workflow runs.",
    icon: Globe,
    iconColor: "var(--accent-green)",
    includedOnEveryPlan: true,
    available: true,
    hiddenFromDirectory: true,
  },
  {
    key: "slack",
    name: "Slack",
    category: "Communication",
    summary: "Trigger on Slack messages and post updates into your channels.",
    description:
      "Connect your Slack workspace to start workflows from channel activity and to send messages, digests and alerts back into Slack.",
    notes: ["Connected through Slack OAuth", "Available on paid plans"],
    icon: Hash,
    iconColor: "#E01E5A",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787655163/1000116191-removebg-preview_k0jbmj.png",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "CRM",
    summary: "Keep contacts and deals in sync with your automations.",
    description:
      "Connect your HubSpot portal so workflows can read and update contact records as leads move through your pipeline.",
    notes: ["Connected through HubSpot OAuth", "Available on paid plans"],
    icon: Building2,
    iconColor: "#FF7A59",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787755331/1000116508-removebg-preview_o5rdkh.png",
    endpoint: "hubspot",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "zoho",
    name: "Zoho Books",
    category: "Finance",
    summary: "Cash-flow digests, overdue tracking and customer health, straight from your books.",
    description:
      "Connect Zoho Books so Synkra can read invoices, payments, expenses and contacts to power finance workflows — weekly cash-flow digests, payment reminders and churn alerts — and write back notes once a reminder's been sent. Nothing is ever emailed or updated in Zoho without your one-click approval first.",
    notes: ["Connected through Zoho OAuth", "Available on paid plans"],
    icon: DollarSign,
    iconColor: "#E42527",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    summary: "Send WhatsApp messages from a workflow.",
    description:
      "WhatsApp sending uses a metered messaging provider. Message allowance depends on your plan and any messaging add-ons.",
    notes: ["Metered — uses your WhatsApp allowance", "Available on paid plans"],
    icon: MessageCircle,
    iconColor: "#25D366",
    requiresPaidPlan: true,
    available: true,
    hiddenFromDirectory: true,
  },
  {
    key: "sms",
    name: "SMS",
    category: "Messaging",
    summary: "Send text messages from a workflow.",
    description:
      "SMS sending uses a metered messaging provider. Message allowance depends on your plan and any messaging add-ons.",
    notes: ["Metered — uses your SMS allowance", "Available on paid plans"],
    icon: Smartphone,
    iconColor: "var(--state-warning)",
    requiresPaidPlan: true,
    available: true,
    hiddenFromDirectory: true,
  },
];

export type IntegrationStateKind =
  | "connected"
  | "included"
  | "error"
  | "locked"
  | "disconnected"
  | "unavailable";

export const INTEGRATION_STATUS_FILTERS: { value: IntegrationStateKind; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "disconnected", label: "Not connected" },
  { value: "included", label: "Included on your plan" },
  { value: "locked", label: "Needs a paid plan" },
  { value: "unavailable", label: "Not available yet" },
];

export function findIntegration(key: string | undefined | null) {
  if (!key) return undefined;
  return INTEGRATIONS.find((item) => item.key === key);
}

/** Free-text match across name, key, category and summary. */
export function matchesQuery(item: IntegrationDefinition, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.key, item.category, item.summary, item.description]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

/**
 * Current state of one integration for this user: the stored connection status
 * wins, then the plan gate, then the catalog's own availability.
 */
export function resolveIntegrationState(
  item: IntegrationDefinition,
  planAllows: boolean,
  status: string | undefined,
): IntegrationStateKind {
  if (item.includedOnEveryPlan) return "included";
  if (item.available === false) return "unavailable";
  if (status === "connected") return "connected";
  if (status === "error") return "error";
  if (item.requiresPaidPlan && !planAllows) return "locked";
  return "disconnected";
}

  
