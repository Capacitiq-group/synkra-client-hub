/**
 * Integration directory catalog — SINGLE SOURCE OF TRUTH for the directory UI.
 *
 * Rules for this file:
 * - Only list platforms Synkra actually has code for today. No placeholder
 *   integrations and no categories that exist purely to look full.
 * - `availability` must describe reality:
 *     "built_in"  -> works with no setup (first-party platform capability)
 *     "available" -> a real connect flow exists in this codebase
 *     "not_yet"   -> listed for visibility only; no automation exists yet
 * - Third-party logos use the official hosted image, and each one gets the
 *   background it individually needs. There is no single default that keeps
 *   every logo legible.
 */

import { Mail, Star, type LucideIcon } from "lucide-react";

export const INTEGRATION_CATEGORIES = ["Communication", "CRM", "Reviews"] as const;

export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export type IntegrationAvailability = "built_in" | "available" | "not_yet";

export interface IntegrationDefinition {
  /** Matches the `type` field on the PocketBase `integrations` collection. */
  key: string;
  name: string;
  category: IntegrationCategory;
  /** One line for the card. */
  summary: string;
  /** Longer copy for the detail dialog. */
  description: string;
  availability: IntegrationAvailability;
  /** Paid-plan gating. Every external platform requires a paid plan. */
  requiresPaidPlan: boolean;
  /** Only set when a real connect endpoint exists. */
  endpoint?: "hubspot" | "slack";
  /** Extra facts shown in the detail dialog. */
  notes?: string[];
  /** Search aliases, so "chat" finds Slack. */
  keywords?: string[];
  /** Lucide icon for first-party rows only. */
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  /** Official hosted logo for third-party platforms. */
  logoUrl?: string;
  /** Per-logo backing colour. Chosen per logo, never assumed. */
  logoBg?: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    key: "email",
    name: "Email sending",
    category: "Communication",
    summary: "Platform email delivery used by any workflow that sends mail.",
    description:
      "Synkra sends workflow email on your behalf from your business address. Nothing to connect — it is part of the platform and is already active on your account.",
    availability: "built_in",
    requiresPaidPlan: false,
    notes: ["Included on every plan.", "Monthly email volume is limited by your plan."],
    keywords: ["mail", "smtp", "notification"],
    icon: Mail,
    iconColor: "var(--text-primary)",
    iconBg: "var(--bg-primary)",
  },
  {
    key: "slack",
    name: "Slack",
    category: "Communication",
    summary: "Connect your workspace so workflows can watch and act on channel messages.",
    description:
      "Connecting Slack lets workflows start from channel activity — new messages, questions nobody answered, and once-a-day digests. Connecting opens Slack's authorisation window. Workflows only see the channels you add the Synkra bot to.",
    availability: "available",
    // Unchanged platform rule: connecting any external app requires a paid plan.
    requiresPaidPlan: true,
    endpoint: "slack",
    notes: [
      "Connect uses Slack OAuth in a popup window.",
      "Requires a paid plan, like every other platform connection.",
      "Only channels the Synkra bot has been added to are visible to workflows.",
      "Two of the three Slack templates use AI credits; the digest and triage templates are AI-powered.",
    ],
    keywords: ["chat", "messaging", "channels", "team"],
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787655163/1000116191-removebg-preview_k0jbmj.png",
    // The Slack mark is supplied with a transparent background and its colours
    // disappear on the dark app surface, so it specifically needs white behind it.
    logoBg: "#FFFFFF",
  },

  {
    key: "hubspot",
    name: "HubSpot",
    category: "CRM",
    summary: "Connect your CRM so workflows can act on deals and contacts.",
    description:
      "Automatically follow up, escalate, and personalise outreach based on deals and contacts in your HubSpot CRM. Connecting opens HubSpot's OAuth flow.",
    availability: "available",
    requiresPaidPlan: true,
    endpoint: "hubspot",
    notes: ["Connect uses HubSpot OAuth.", "Requires a paid plan."],
    keywords: ["crm", "sales", "deals", "contacts"],
    logoUrl:
      "https://res.cloudinary.com/dewvhnks3/image/upload/v1787420665/HubSpot-Logo_xqgtan.png",
    // HubSpot's mark is charcoal + orange, so it needs a light neutral chip.
    logoBg: "#F5F5F3",
  },
  {
    key: "review_destinations",
    name: "Review destinations",
    category: "Reviews",
    summary: "Collect reviews on Google, HelloPeter, or your own website widget.",
    description:
      "Review requests are outbound emails carrying your review links, so any destination with a public review URL works with the existing automation. Add and order your destinations in Settings → Business. Nothing is ever published to a platform on your customer's behalf.",
    availability: "built_in",
    requiresPaidPlan: false,
    notes: [
      "Included on every plan — it uses the platform email you already have.",
      "Supports Google, HelloPeter, and your own website review widget.",
    ],
    keywords: ["review", "reviews", "google", "hellopeter", "rating", "feedback", "testimonial"],
    icon: Star,
    iconColor: "var(--text-primary)",
    iconBg: "var(--bg-primary)",
  },
];

export function findIntegration(key?: string | undefined): IntegrationDefinition | undefined {
  if (!key) return undefined;
  return INTEGRATIONS.find((item) => item.key === key);
}

export function matchesQuery(item: IntegrationDefinition, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (item.name.toLowerCase().includes(text)) return true;
  return (item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(text));
}

export type StatusTone = "success" | "warning" | "error" | "muted";

export interface IntegrationStatus {
  label: string;
  tone: StatusTone;
}

/**
 * Honest status line. Never claims a platform works when it does not:
 * "not yet available" wins over everything, and a paid-plan requirement is
 * stated before "available now".
 */
export function resolveStatus(
  item: IntegrationDefinition,
  planAllows: boolean,
  recordStatus?: string | undefined,
): IntegrationStatus {
  if (item.availability === "not_yet") return { label: "Not yet available", tone: "warning" };
  if (item.availability === "built_in") return { label: "Active — included", tone: "success" };
  if (recordStatus === "connected") return { label: "Connected", tone: "success" };
  if (recordStatus === "error") return { label: "Connection error", tone: "error" };
  if (item.requiresPaidPlan && !planAllows)
    return { label: "Requires a paid plan", tone: "muted" };
  return { label: "Available now — not connected", tone: "muted" };
}

export function statusColor(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "var(--state-success)";
    case "warning":
      return "var(--state-warning)";
    case "error":
      return "var(--state-error)";
    default:
      return "var(--text-muted)";
  }
      }
