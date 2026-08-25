// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Channel enforcement for notifications (server only).
 *
 * The browser can toggle preferences, but it can never decide whether an email
 * goes out: the tier and the toggle are re-read from the `users` record here,
 * through the superuser client, immediately before delivery.
 */
import type PocketBase from "pocketbase";
import { resolveDelivery, type DeliveryDecision } from "./notification-preferences";
import { normalizeTier } from "./plans";

export interface ResolvedRecipient extends DeliveryDecision {
  /** Address email should go to (notification_email, else the login email). */
  emailAddress: string;
}

/**
 * Loads the recipient's preferences + tier and resolves which channels this
 * event may use. A missing/unreadable user record withholds both channels
 * rather than defaulting to sending.
 */
export async function resolveRecipientDelivery(
  pb: PocketBase,
  userId: string,
  eventType: string,
): Promise<ResolvedRecipient | null> {
  let record: Record<string, unknown>;
  try {
    record = (await pb.collection("users").getOne(userId)) as unknown as Record<string, unknown>;
  } catch (err) {
    console.error("notification recipient lookup failed", err);
    return null;
  }

  const decision = resolveDelivery(record, normalizeTier(record["tier"]), eventType);
  const address =
    (typeof record["notification_email"] === "string" && record["notification_email"]) ||
    (typeof record["email"] === "string" && record["email"]) ||
    "";

  return { ...decision, emailAddress: address };
}
