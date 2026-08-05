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
