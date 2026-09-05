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
  Calendar,
  CheckSquare,
  ClipboardList,
  DollarSign,
  Globe,
  Hash,
  KanbanSquare,
  Mail,
  MessageCircle,
  Notebook,
  ShoppingBag,
  Smartphone,
  Table2,
  Target,
  Trello,
  type LucideIcon,
} from "lucide-react";

export const INTEGRATION_CATEGORIES = [
  "Communication",
  "CRM",
  "Messaging",
  "Automation",
  "AI",
  "Finance",
  "Commerce",
  "Forms",
  "Scheduling",
  "Productivity",
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
  /**
   * OAuth endpoint name, when Synkra brokers the connection itself —
   * matches the `/integrations/{endpoint}` router prefix on the API.
   * Any key not equal to "hubspot", "slack", or "zoho" is routed through
   * the generic connect flow (see components/integrations/generic-connect.tsx)
   * rather than a bespoke per-provider component.
   */
  endpoint?: string;
  /** Tally has no OAuth — the user pastes an API key instead. */
  authMethod?: "oauth" | "api_key";
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
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787877216/1000116922-removebg-preview_vdhocb.png",
    logoBg: "#FFFFFF",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "clickup",
    name: "ClickUp",
    category: "Automation",
    summary: "Turn incoming requests into tasks, and let ClickUp activity kick off workflows.",
    description:
      "Connect ClickUp so workflows can create and update tasks in the lists you choose, and so a change in ClickUp (a task created, moved or commented on) can start a workflow of its own. Enabling this integration doesn't turn on any template by itself — each template still needs to be switched on individually.",
    notes: ["Connected through ClickUp OAuth", "Available on paid plans"],
    icon: CheckSquare,
    iconColor: "#7B68EE",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788201412/1000117702-removebg-preview_tpyxm3.png",
    logoBg: "#FFFFFF",
    endpoint: "clickup",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "notion",
    name: "Notion",
    category: "Automation",
    summary: "Read and update Notion databases, and start workflows from new database rows.",
    description:
      "Connect Notion so workflows can read from and write to the databases you explicitly share with Synkra inside Notion, and so a new row in a shared database can start a workflow. Only databases you share with the Synkra connection are visible here — that sharing step happens inside Notion itself, in addition to the OAuth connection.",
    notes: ["Connected through Notion OAuth", "You must also share each database with Synkra inside Notion", "Available on paid plans"],
    icon: Notebook,
    iconColor: "#000000",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788201412/1000117703-removebg-preview_bdhz7m.png",
    logoBg: "#FFFFFF",
    endpoint: "notion",
    authMethod: "oauth",
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
  {
    key: "shopify",
    name: "Shopify",
    category: "Commerce",
    summary: "Catalogue audits, inventory risk and customer value reports powered by AI.",
    description:
      "Connect your Shopify store so Synkra can analyse products, inventory and orders — surfacing catalogue quality issues, stockout risk and customer value, none of which Shopify Flow does natively.",
    notes: ["Connected through Shopify OAuth", "Available on paid plans", "Read-only — no template writes back to your store"],
    icon: ShoppingBag,
    iconColor: "#95BF47",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338003/1000118000-removebg-preview_nyxh32.png",
    logoBg: "#FFFFFF",
    endpoint: "shopify",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "typeform",
    name: "Typeform",
    category: "Forms",
    summary: "AI qualification, screening and feedback digests from your form responses.",
    description:
      "Connect Typeform so Synkra can score and qualify new responses against your own criteria, screen applications, and summarise recurring themes across a form's answers.",
    notes: ["Connected through Typeform OAuth", "Available on paid plans"],
    icon: ClipboardList,
    iconColor: "#262627",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338003/1000118001-removebg-preview_g5lhnq.png",
    logoBg: "#FFFFFF",
    endpoint: "typeform",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "tally",
    name: "Tally",
    category: "Forms",
    summary: "AI submission qualification and screening from your Tally forms.",
    description:
      "Connect Tally with an API key so Synkra can qualify submissions, screen applications and produce feedback digests. Tally's API keys are account-wide — see the connection dialog for details.",
    notes: ["Connected with a Tally API key, not OAuth", "The key inherits your full Tally account access", "Available on paid plans"],
    icon: ClipboardList,
    iconColor: "#000000",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338153/1000118004-removebg-preview_f9o4cr.png",
    logoBg: "#FFFFFF",
    endpoint: "tally",
    authMethod: "api_key",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "calendly",
    name: "Calendly",
    category: "Scheduling",
    summary: "AI meeting debriefs, no-show follow-ups and recurring meeting intelligence.",
    description:
      "Connect Calendly so Synkra can summarise completed meetings, draft personalised no-show follow-ups, and spot recurring topics and objections across your bookings.",
    notes: ["Connected through Calendly OAuth", "Available on paid plans"],
    icon: Calendar,
    iconColor: "#006BFF",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338153/1000118005-removebg-preview_h90ec7.png",
    logoBg: "#FFFFFF",
    endpoint: "calendly",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "xero",
    name: "Xero",
    category: "Finance",
    summary: "Receivables risk, invoice review and customer payment-behaviour reports.",
    description:
      "Connect Xero so Synkra can analyse outstanding invoices, payments and contacts — surfacing collection risk and payment-behaviour patterns your accounting workflows don't.",
    notes: ["Connected through Xero OAuth", "Uses Xero's granular accounting scopes", "Available on paid plans"],
    icon: DollarSign,
    iconColor: "#13B5EA",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338396/1000118008-removebg-preview_xe1zbr.png",
    logoBg: "#FFFFFF",
    endpoint: "xero",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "airtable",
    name: "Airtable",
    category: "Productivity",
    summary: "AI data-quality audits and record escalation across your bases.",
    description:
      "Connect Airtable so Synkra can audit records for inconsistencies and duplicates, and flag records that need human attention — with an optional write-back of the review result.",
    notes: ["Connected through Airtable OAuth", "Available on paid plans"],
    icon: Table2,
    iconColor: "#FFBF00",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338465/1000118009-removebg-preview_vfabtd.png",
    logoBg: "#FFFFFF",
    endpoint: "airtable",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "monday",
    name: "Monday.com",
    category: "Productivity",
    summary: "AI project health, workload risk and blocker escalation reports.",
    description:
      "Connect Monday.com so Synkra can read your boards and turn item status, dates and updates into project health reports, workload risk reviews and blocker escalations.",
    notes: ["Connected through Monday.com OAuth", "Available on paid plans"],
    icon: KanbanSquare,
    iconColor: "#FF3D57",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338396/1000118010-removebg-preview_fa4rq8.png",
    logoBg: "#FFFFFF",
    endpoint: "monday",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "asana",
    name: "Asana",
    category: "Productivity",
    summary: "AI project risk reviews, task handoffs and overdue-work triage.",
    description:
      "Connect Asana so Synkra can analyse tasks, dependencies and discussion to surface project risk, draft handoff briefs, and triage overdue work by likely cause.",
    notes: ["Connected through Asana OAuth", "Available on paid plans"],
    icon: Trello,
    iconColor: "#F06A6A",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338395/ASAN-1325de11_tyu9of.png",
    logoBg: "#FFFFFF",
    endpoint: "asana",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    category: "CRM",
    summary: "AI deal health reviews, sales call briefs and stalled-deal analysis.",
    description:
      "Connect Pipedrive so Synkra can assess deal momentum and risk, brief you before a sales call, and identify why a deal has stalled — sales intelligence on top of your pipeline, not another follow-up sequence.",
    notes: ["Connected through Pipedrive OAuth", "Available on paid plans"],
    icon: Target,
    iconColor: "#000000",
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1788338395/pipedrivecrm_123_logo_1708948064_nrwju_lpvkcd.png",
    logoBg: "#FFFFFF",
    endpoint: "pipedrive",
    authMethod: "oauth",
    requiresPaidPlan: true,
    available: true,
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

  
