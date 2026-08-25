/**
 * Notification preference rules — SINGLE SOURCE OF TRUTH (pure, client-safe).
 *
 * Every preference toggle in Settings → Notifications maps to one entry here.
 * The same table is used by:
 *   - the settings UI (labels, channel copy, paid-plan marking)
 *   - the server-side writer (`notification-feed.server.ts`), which refuses to
 *     write an in-app row or send an email that these rules disallow.
 *
 * Channel rules by tier:
 *   free  -> in-app for every event. Email ONLY for credit-balance alerts and
 *            platform updates.
 *   paid  -> in-app plus email for every preference the user has enabled.
 */
import { normalizeTier, type PlanTier } from "./plans";

export interface NotificationPreferenceDef {
  /** `event_type` written to the notifications collection. */
  eventType: string;
  /** Boolean field on the `users` record that stores the toggle. */
  field: string;
  label: string;
  /** What the notification is about (channel-independent). */
  description: string;
  /** Value used when the user record has no stored value. */
  defaultEnabled: boolean;
  /** Whether email delivery for this event requires a paid plan. */
  emailRequiresPaid: boolean;
}

export const NOTIFICATION_PREFERENCES: NotificationPreferenceDef[] = [
  {
    eventType: "workflow_failed",
    field: "notify_on_failure",
    label: "Workflow failed",
    description: "When an automation stops with an error.",
    defaultEnabled: true,
    emailRequiresPaid: true,
  },
  {
    eventType: "weekly_summary",
    field: "notify_weekly_summary",
    label: "Weekly summary",
    description: "A summary of your workflow runs every Monday at 8am.",
    defaultEnabled: true,
    emailRequiresPaid: true,
  },
  {
    eventType: "workflow_completed",
    field: "notify_on_success",
    label: "Workflow completed",
    description: "Each time a workflow finishes running successfully.",
    defaultEnabled: false,
    emailRequiresPaid: true,
  },
  {
    eventType: "credit_balance_low",
    field: "notify_credit_low",
    label: "Credit balance low",
    description: "When a credit type drops below 20 percent remaining.",
    defaultEnabled: true,
    emailRequiresPaid: false,
  },
  {
    eventType: "platform_update",
    field: "notify_platform_updates",
    label: "Platform updates",
    description: "Occasional news about new templates and features.",
    defaultEnabled: false,
    emailRequiresPaid: false,
  },
];

const BY_EVENT = new Map(NOTIFICATION_PREFERENCES.map((def) => [def.eventType, def]));
const BY_FIELD = new Map(NOTIFICATION_PREFERENCES.map((def) => [def.field, def]));

export function preferenceForEvent(eventType: string): NotificationPreferenceDef | undefined {
  return BY_EVENT.get(eventType);
}

export function preferenceForField(field: string): NotificationPreferenceDef | undefined {
  return BY_FIELD.get(field);
}

/** True when the tier is a paid plan (anything above free). */
export function isPaidTier(tier: unknown): boolean {
  return normalizeTier(tier) !== "free";
}

/**
 * Reads the stored toggle, falling back to the documented default when the
 * field is absent or not a boolean.
 */
export function preferenceEnabled(
  prefs: Record<string, unknown> | null | undefined,
  eventType: string,
): boolean {
  const def = preferenceForEvent(eventType);
  if (!def) return true; // unknown event types stay visible in the feed
  const stored = prefs?.[def.field];
  return typeof stored === "boolean" ? stored : def.defaultEnabled;
}

/** Whether this tier is allowed email for this event at all (toggle aside). */
export function emailChannelAvailable(tier: unknown, eventType: string): boolean {
  const def = preferenceForEvent(eventType);
  if (!def) return false;
  return def.emailRequiresPaid ? isPaidTier(tier) : true;
}

export type DeliveryBlockReason = "preference_off" | "email_requires_paid_plan" | "unknown_event";

export interface DeliveryDecision {
  /** Write an in-app notification row. */
  inApp: boolean;
  /** Also send an email. */
  email: boolean;
  tier: PlanTier;
  /** Why a channel was withheld (only set when something was withheld). */
  reason?: DeliveryBlockReason;
}

/**
 * The single decision function. Both channels are governed by the user's
 * toggle; email is additionally governed by the tier rules above.
 */
export function resolveDelivery(
  prefs: Record<string, unknown> | null | undefined,
  tier: unknown,
  eventType: string,
): DeliveryDecision {
  const normalized = normalizeTier(tier);
  const def = preferenceForEvent(eventType);
  if (!def) {
    return { inApp: true, email: false, tier: normalized, reason: "unknown_event" };
  }
  if (!preferenceEnabled(prefs, eventType)) {
    return { inApp: false, email: false, tier: normalized, reason: "preference_off" };
  }
  const emailAvailable = emailChannelAvailable(normalized, eventType);
  return {
    inApp: true,
    email: emailAvailable,
    tier: normalized,
    ...(emailAvailable ? {} : { reason: "email_requires_paid_plan" as const }),
  };
}

/** UI copy: which channels this event actually uses for the given tier. */
export function channelLabel(tier: unknown, eventType: string): string {
  return emailChannelAvailable(tier, eventType) ? "In-app + email" : "In-app only";
}

/** UI copy shown under a row whose email channel is gated. */
export const EMAIL_PAID_PLAN_NOTE =
  "Email for this event requires a paid plan. On the free plan this toggle controls your in-app notification feed.";
  
