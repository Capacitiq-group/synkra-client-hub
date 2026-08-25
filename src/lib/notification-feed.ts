// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * In-app notification feed — browser side.
 *
 * Notifications are persisted rows in the PocketBase `notifications`
 * collection (see pb_schema.json). Rows are written server-side with the
 * superuser client; the browser can only list/view/update/delete its OWN rows
 * (`user_id = @request.auth.id`), which is what "mark as read" uses.
 */
import pb, { getListSafe } from "@/lib/pocketbase";
import { eventMeta, type NotificationEventType, type NotificationSeverity } from "./notification-events";

export interface AppNotification {
  id: string;
  userId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  readAt: Date | null;
  workflowId: string | null;
  runId: string | null;
  /** Explicit deep link stored on the row, if any. */
  link: string | null;
  severity: NotificationSeverity;
  metadata: Record<string, unknown>;
}

export const NOTIFICATIONS_COLLECTION = "notifications";

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optional(value: unknown): string | null {
  const str = text(value);
  return str ? str : null;
}

export function mapNotification(record: Record<string, unknown>): AppNotification {
  const eventType = text(record["event_type"]) || "unknown";
  const meta = eventMeta(eventType);
  const storedSeverity = text(record["severity"]) as NotificationSeverity;
  const severity = (["info", "success", "warning", "error"] as string[]).includes(storedSeverity)
    ? storedSeverity
    : meta.severity;

  return {
    id: String(record["id"] ?? ""),
    userId: text(record["user_id"]),
    eventType,
    title: text(record["title"]) || meta.label,
    message: text(record["message"]),
    createdAt: new Date(text(record["created"]) || Date.now()),
    read: record["read"] === true,
    readAt: text(record["read_at"]) ? new Date(text(record["read_at"])) : null,
    workflowId: optional(record["workflow_id"]),
    runId: optional(record["run_id"]),
    link: optional(record["link"]),
    severity,
    metadata: parseMetadata(record["metadata"]),
  };
}

export interface FetchNotificationsOptions {
  userId: string;
  page?: number;
  perPage?: number;
  /** Only unread rows. */
  unreadOnly?: boolean;
  /** Restrict to a single event type. */
  eventType?: string;
}

export interface NotificationPage {
  items: AppNotification[];
  totalItems: number;
  totalPages: number;
  page: number;
}

export async function fetchNotifications(
  options: FetchNotificationsOptions,
): Promise<NotificationPage> {
  const clauses = [pb.filter("user_id = {:userId}", { userId: options.userId })];
  if (options.unreadOnly) clauses.push("read = false");
  if (options.eventType) {
    clauses.push(pb.filter("event_type = {:eventType}", { eventType: options.eventType }));
  }

  const result = await getListSafe<Record<string, unknown>>(
    NOTIFICATIONS_COLLECTION,
    options.page ?? 1,
    options.perPage ?? 20,
    { filter: clauses.join(" && "), sort: "-created" },
  );

  return {
    items: result.items.map(mapNotification),
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    page: result.page,
  };
}

/** Number of unread notifications for the signed-in user. */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const result = await getListSafe<Record<string, unknown>>(NOTIFICATIONS_COLLECTION, 1, 1, {
    filter: `${pb.filter("user_id = {:userId}", { userId })} && read = false`,
    fields: "id",
  });
  return result.totalItems;
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await pb.collection(NOTIFICATIONS_COLLECTION).update(id, {
    read,
    read_at: read ? new Date().toISOString() : "",
  });
}

/** Marks every unread row for the user as read. Returns how many were updated. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const unread = await pb.collection(NOTIFICATIONS_COLLECTION).getFullList({
    filter: `${pb.filter("user_id = {:userId}", { userId })} && read = false`,
    fields: "id",
  });
  const now = new Date().toISOString();
  await Promise.all(
    unread.map((row) =>
      pb.collection(NOTIFICATIONS_COLLECTION).update(row.id, { read: true, read_at: now }),
    ),
  );
  return unread.length;
}

/* ------------------------------------------------------------------ */
/* Deep-link resolution                                                */
/* ------------------------------------------------------------------ */

/** Portal destinations a notification is allowed to open. */
export type NotificationPath =
  | "/dashboard"
  | "/dashboard/activity"
  | "/dashboard/workflows"
  | "/dashboard/data"
  | "/dashboard/integrations"
  | "/dashboard/help"
  | "/dashboard/notifications"
  | "/dashboard/settings";

const ALLOWED_PATHS: NotificationPath[] = [
  "/dashboard",
  "/dashboard/activity",
  "/dashboard/workflows",
  "/dashboard/data",
  "/dashboard/integrations",
  "/dashboard/help",
  "/dashboard/notifications",
  "/dashboard/settings",
];

const SETTINGS_TABS = ["profile", "business", "workspace", "usage", "billing", "notifications"];

export type NotificationTarget =
  | { kind: "run"; runId: string }
  | { kind: "workflow"; workflowId: string }
  | { kind: "settings"; tab: string }
  | { kind: "path"; path: NotificationPath };

/**
 * Where clicking a notification goes. Resolution order:
 *   1. run_id  -> the run detail panel on Activity
 *   2. workflow_id -> that workflow in the builder
 *   3. an explicit internal `link` (validated against the allow-list)
 *   4. the event type's fallback route
 * Every branch ends on a real portal route, so a notification is never a dead
 * end even if it was written by another service with a stale link.
 */
export function notificationTarget(notification: AppNotification): NotificationTarget {
  if (notification.runId) return { kind: "run", runId: notification.runId };
  if (notification.workflowId) return { kind: "workflow", workflowId: notification.workflowId };

  const fromLink = parseInternalLink(notification.link);
  if (fromLink) return fromLink;

  const fromFallback = parseInternalLink(eventMeta(notification.eventType).fallbackLink);
  return fromFallback ?? { kind: "path", path: "/dashboard/notifications" };
}

/** Parses an internal link like `/dashboard/settings?tab=usage`. */
export function parseInternalLink(link: string | null | undefined): NotificationTarget | null {
  if (!link || !link.startsWith("/")) return null;
  const [rawPath, rawQuery] = link.split("?");
  const path = (rawPath ?? "").replace(/\/+$/, "") || "/dashboard";
  const params = new URLSearchParams(rawQuery ?? "");

  const run = params.get("run");
  if (path === "/dashboard/activity" && run) return { kind: "run", runId: run };

  if (path === "/dashboard/settings") {
    const tab = params.get("tab") ?? "profile";
    return { kind: "settings", tab: SETTINGS_TABS.includes(tab) ? tab : "profile" };
  }

  const builder = /^\/dashboard\/workflows\/builder\/([A-Za-z0-9_-]+)$/.exec(path);
  if (builder?.[1] && builder[1] !== "new") return { kind: "workflow", workflowId: builder[1] };

  const allowed = ALLOWED_PATHS.find((candidate) => candidate === path);
  return allowed ? { kind: "path", path: allowed } : null;
    }
                                  
