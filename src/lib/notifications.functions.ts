import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  fromName: z.string().max(100).optional(),
  replyTo: z.string().email().optional(),
});

/**
 * Server-side proxy to the synkra-core email endpoint. The shared API secret is
 * read here so it never reaches the browser bundle.
 */
export const sendNotificationEmailFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiUrl = process.env["API_URL"] || "https://api.synkra.co.za";
    const apiSecret = process.env["API_SECRET"] || "";
    try {
      const response = await fetch(`${apiUrl}/workflows/notifications/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Synkra-Secret": apiSecret },
        body: JSON.stringify({
          to: data.to,
          subject: data.subject,
          body: data.body,
          from_name: data.fromName || "Synkra",
          reply_to: data.replyTo,
        }),
      });
      return { ok: response.ok };
    } catch (err) {
      console.error("Email notification failed:", err);
      return { ok: false };
    }
  });

const deliverSchema = z.object({
  token: z.string().min(10),
  eventType: z.enum(["workflow_failed", "workflow_completed", "credit_balance_low"]),
  title: z.string().min(1).max(200),
  message: z.string().max(2000).optional(),
  link: z.string().max(300).optional(),
  runId: z.string().max(50).optional(),
  workflowId: z.string().max(50).optional(),
  dedupeKey: z.string().max(200).optional(),
});

/**
 * Enforced notification delivery for browser-observed events (e.g. a failed run
 * seen over realtime).
 *
 * The caller's token is verified and the notification is always created for the
 * token's own user id — the browser cannot notify anyone else, cannot choose a
 * channel, and cannot bypass the free/paid email rules: `createNotification`
 * re-reads the tier and the preference server-side and decides both channels.
 */
export const deliverNotificationEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deliverSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("./usage/pocketbase.server");
    const { createNotification } = await import("./notification-feed.server");
    const { userId } = await verifyUserToken(data.token);
    const result = await createNotification({
      userId,
      eventType: data.eventType,
      title: data.title,
      ...(data.message ? { message: data.message } : {}),
      ...(data.link ? { link: data.link } : {}),
      ...(data.runId ? { runId: data.runId } : {}),
      ...(data.workflowId ? { workflowId: data.workflowId } : {}),
      ...(data.dedupeKey ? { dedupeKey: data.dedupeKey } : {}),
    });
    return {
      created: result.created,
      emailSent: Boolean(result.emailSent),
      reason: result.reason ?? null,
      emailSkipped: result.emailSkipped ?? null,
    };
  });
