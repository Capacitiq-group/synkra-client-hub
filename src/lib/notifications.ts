import { sendNotificationEmailFn } from "./notifications.functions";

export interface NotificationEmail {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Sends a notification email through the synkra-core API.
 * The request is proxied by our own server so the shared API secret is never
 * exposed in the browser bundle.
 */
export async function sendNotificationEmail(params: NotificationEmail): Promise<boolean> {
  try {
    const result = await sendNotificationEmailFn({ data: params });
    return Boolean(result?.ok);
  } catch (err) {
    console.error("Email notification failed:", err);
    return false;
  }
}
