/**
 * In-app notification event registry (client-safe, pure).
 *
 * `event_type` is stored as free text in PocketBase, NOT as a select field, so
 * a new notification type only needs an entry in this registry — no schema
 * change, no migration, no restructuring. Any type that reaches the portal
 * without an entry still renders correctly through UNKNOWN_EVENT rather than
 * disappearing or crashing the feed.
 */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

/** The categories a notification can be filtered by in the UI. */
export type NotificationGroup = "runs" | "billing" | "reports" | "product" | "finance";

export interface NotificationEventMeta {
  /** Stable machine value written to `event_type`. */
  type: string;
  /** Short human label used in the feed and filters. */
  label: string;
  severity: NotificationSeverity;
  group: NotificationGroup;
  /**
   * Fallback route when a notification carries no explicit link and no
   * workflow/run reference. Never a dead end.
   */
  fallbackLink: string;
}

export const NOTIFICATION_EVENTS = {
  workflow_completed: {
    type: "workflow_completed",
    label: "Workflow completed",
    severity: "success",
    group: "runs",
    fallbackLink: "/dashboard/activity",
  },
  workflow_failed: {
    type: "workflow_failed",
    label: "Workflow failed",
    severity: "error",
    group: "runs",
    fallbackLink: "/dashboard/activity",
  },
  credit_balance_low: {
    type: "credit_balance_low",
    label: "Credit balance low",
    severity: "warning",
    group: "billing",
    fallbackLink: "/dashboard/settings?tab=usage",
  },
  weekly_summary: {
    type: "weekly_summary",
    label: "Weekly summary",
    severity: "info",
    group: "reports",
    fallbackLink: "/dashboard/activity",
  },
  platform_update: {
    type: "platform_update",
    label: "Platform update",
    severity: "info",
    group: "product",
    fallbackLink: "/dashboard/help",
  },
  // Zoho Books finance workflows (workflows/zoho/*.py in synkra-core).
  // The three "*_ready"-style types below are pending_approvals items —
  // they always link to /dashboard/approvals, where the one-click
  // approve/reject action actually lives.
  zoho_cashflow_digest: {
    type: "zoho_cashflow_digest",
    label: "Cash-flow digest",
    severity: "info",
    group: "finance",
    fallbackLink: "/dashboard/integrations",
  },
  zoho_churn_detector: {
    type: "zoho_churn_detector",
    label: "Customer going quiet",
    severity: "warning",
    group: "finance",
    fallbackLink: "/dashboard/integrations",
  },
  zoho_contact_dedupe: {
    type: "zoho_contact_dedupe",
    label: "Contact data quality",
    severity: "warning",
    group: "finance",
    fallbackLink: "/dashboard/integrations",
  },
  zoho_invoice_reminder: {
    type: "zoho_invoice_reminder",
    label: "Payment reminder ready",
    severity: "warning",
    group: "finance",
    fallbackLink: "/dashboard/approvals",
  },
  zoho_customer_checkin: {
    type: "zoho_customer_checkin",
    label: "Check-in email ready",
    severity: "warning",
    group: "finance",
    fallbackLink: "/dashboard/approvals",
  },
  zoho_contact_datafix: {
    type: "zoho_contact_datafix",
    label: "Contact fix ready",
    severity: "info",
    group: "finance",
    fallbackLink: "/dashboard/approvals",
  },
} as const satisfies Record<string, NotificationEventMeta>;

/** The types this build knows about. Adding one here is the only step needed. */
export type KnownNotificationEvent = keyof typeof NOTIFICATION_EVENTS;

/** Any string is accepted on read, so older/newer servers never break the feed. */
export type NotificationEventType = KnownNotificationEvent | (string & {});

export const UNKNOWN_EVENT: NotificationEventMeta = {
  type: "unknown",
  label: "Notification",
  severity: "info",
  group: "product",
  fallbackLink: "/dashboard/notifications",
};

export function eventMeta(type: string): NotificationEventMeta {
  return (
    (NOTIFICATION_EVENTS as Record<string, NotificationEventMeta>)[type] ?? {
      ...UNKNOWN_EVENT,
      type,
    }
  );
}

/** True when the type has a registry entry in this build. */
export function isKnownEvent(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_EVENTS, type);
}

export const NOTIFICATION_EVENT_LIST: NotificationEventMeta[] = Object.values(NOTIFICATION_EVENTS);

/**
 * Which per-user email preference (a `users` field) mirrors an in-app event.
 * In-app delivery is unconditional; this map is only consulted for email.
 */
export const EMAIL_PREFERENCE_FIELD: Record<string, string> = {
  workflow_completed: "notify_on_success",
  workflow_failed: "notify_on_failure",
  credit_balance_low: "notify_credit_low",
  weekly_summary: "notify_weekly_summary",
  platform_update: "notify_platform_updates",
};
  
