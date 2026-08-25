// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * In-app notification writer (server only).
 *
 * Rows are created with the superuser client because `createRule` on the
 * `notifications` collection is null: the browser can never fabricate a
 * notification for itself or anyone else. Every writer path goes through
 * `createNotification`, which:
 *   - stores the extensible free-text `event_type`
 *   - carries workflow_id / run_id / link so the click target is resolvable
 *   - de-duplicates on `dedupe_key` (unique partial index) so a redelivered
 *     execution callback or a retried cron never produces a duplicate row.
 */
import { adminClient } from "./usage/pocketbase.server";
import { eventMeta, type NotificationSeverity } from "./notification-events";
import { resolveRecipientDelivery } from "./notification-delivery.server";
import { notificationEmail, sendEmail } from "./billing/email.server";

export interface CreateNotificationInput {
  userId: string;
  eventType: string;
  title: string;
  message?: string;
  workflowId?: string;
  runId?: string;
  /** Explicit internal deep link (e.g. `/dashboard/settings?tab=usage`). */
  link?: string;
  severity?: NotificationSeverity;
  metadata?: Record<string, unknown>;
  /**
   * Stable idempotency key. When a row with the same key exists, nothing is
   * written and `created: false` is returned.
   */
  dedupeKey?: string;
}

export interface CreateNotificationResult {
  created: boolean;
  id?: string;
  reason?:
    | "duplicate"
    | "write_failed"
    | "preference_off"
    | "recipient_unknown";
  /** True only when an email was actually accepted by the provider. */
  emailSent?: boolean;
  /** Why email was withheld, when it was. */
  emailSkipped?: "preference_off" | "requires_paid_plan" | "no_address" | "send_failed";
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  if (!input.userId || !input.eventType || !input.title) {
    return { created: false, reason: "write_failed" };
  }

  const pb = await adminClient();

  // Channel enforcement happens BEFORE anything is written or sent: the tier
  // and the user's toggle are read from the users record here, never trusted
  // from the caller.
  const delivery = await resolveRecipientDelivery(pb, input.userId, input.eventType);
  if (!delivery) return { created: false, reason: "recipient_unknown" };
  if (!delivery.inApp && !delivery.email) {
    return { created: false, reason: "preference_off", emailSkipped: "preference_off" };
  }

  if (input.dedupeKey) {
    try {
      const existing = await pb
        .collection("notifications")
        .getFirstListItem(pb.filter("dedupe_key = {:key}", { key: input.dedupeKey }));
      return { created: false, id: existing.id, reason: "duplicate" };
    } catch {
      // Not found: fall through and create it.
    }
  }

  const meta = eventMeta(input.eventType);
  let id: string;
  try {
    const record = await pb.collection("notifications").create({
      user_id: input.userId,
      event_type: input.eventType,
      title: clamp(input.title, 200),
      message: clamp(input.message ?? "", 2000),
      workflow_id: input.workflowId ?? "",
      run_id: input.runId ?? "",
      link: input.link ?? "",
      severity: input.severity ?? meta.severity,
      metadata: input.metadata ?? {},
      read: false,
      dedupe_key: input.dedupeKey ?? "",
    });
    id = record.id;
  } catch (err) {
    // A concurrent writer may have won the unique dedupe index race.
    console.error("notification create failed", err);
    return { created: false, reason: "write_failed" };
  }

  if (!delivery.email) {
    return {
      created: true,
      id,
      emailSent: false,
      emailSkipped:
        delivery.reason === "email_requires_paid_plan" ? "requires_paid_plan" : "preference_off",
    };
  }
  if (!delivery.emailAddress) {
    return { created: true, id, emailSent: false, emailSkipped: "no_address" };
  }

  const result = await sendEmail({
    to: delivery.emailAddress,
    ...notificationEmail(input.title, input.message ?? "", input.link),
  });
  if (!result.ok) {
    console.error("notification email failed", result.error);
    return { created: true, id, emailSent: false, emailSkipped: "send_failed" };
  }
  return { created: true, id, emailSent: true };
}

/** Convenience wrapper for run outcome notifications. */
export async function notifyRunOutcome(params: {
  userId: string;
  workflowId: string;
  workflowName: string;
  runId: string;
  executionId: string;
  status: "success" | "failed";
  errorMessage?: string;
  durationMs?: number;
}): Promise<CreateNotificationResult> {
  const failed = params.status === "failed";
  return createNotification({
    userId: params.userId,
    eventType: failed ? "workflow_failed" : "workflow_completed",
    title: failed
      ? `${params.workflowName} failed`
      : `${params.workflowName} completed successfully`,
    message: failed
      ? params.errorMessage || "The run stopped with an error. Open the run to see the step logs."
      : `The run finished${
          params.durationMs ? ` in ${(params.durationMs / 1000).toFixed(1)}s` : ""
        }.`,
    workflowId: params.workflowId,
    runId: params.runId,
    link: `/dashboard/activity?run=${params.runId}`,
    ...(params.durationMs !== undefined ? { metadata: { durationMs: params.durationMs } } : {}),
    dedupeKey: `${failed ? "workflow_failed" : "workflow_completed"}:${params.runId}`,
  });
}

/**
 * Warns once per billing period, per threshold, when the monthly execution
 * allowance is nearly gone. `remainingPercent` is computed by the caller from
 * the authoritative counters.
 */
export async function notifyCreditsLow(params: {
  userId: string;
  used: number;
  limit: number;
  billingPeriodStart: string;
  threshold: number;
}): Promise<CreateNotificationResult> {
  const remaining = Math.max(0, params.limit - params.used);
  return createNotification({
    userId: params.userId,
    eventType: "credit_balance_low",
    title:
      remaining === 0
        ? "Your monthly executions are used up"
        : `Only ${remaining} of ${params.limit} executions left this month`,
    message:
      remaining === 0
        ? "New runs will be blocked until your plan renews or you buy an execution pack."
        : `You have used ${params.used} of ${params.limit} included executions for this billing period.`,
    link: "/dashboard/settings?tab=usage",
    severity: remaining === 0 ? "error" : "warning",
    metadata: { used: params.used, limit: params.limit, threshold: params.threshold },
    dedupeKey: `credit_balance_low:${params.userId}:${params.billingPeriodStart}:${params.threshold}`,
  });
                                           }
