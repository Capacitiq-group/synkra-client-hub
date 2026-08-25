/**
 * Per-account review destination configuration.
 *
 * Storage shape on the PocketBase `users` record:
 *   review_destinations : json  -> [{ id, url, enabled }]
 *   review_link         : text  -> kept in sync with the primary destination
 *
 * `review_link` is the field the existing automation and the seeded
 * "Review request" template already read, so it is always written with the
 * primary destination's URL. That keeps single-destination behaviour working
 * unchanged while the JSON field carries the full list.
 */

import { isReviewDestinationId, type ReviewDestinationId } from "./destinations";

export interface UserReviewDestination {
  id: ReviewDestinationId;
  url: string;
  /** Disabled rows are kept but excluded from requests and from review_link. */
  enabled: boolean;
}

function coerceRow(value: unknown): UserReviewDestination | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = row["id"];
  if (!isReviewDestinationId(id)) return null;
  const url = typeof row["url"] === "string" ? row["url"].trim() : "";
  return { id, url, enabled: row["enabled"] !== false };
}

/**
 * Reads the saved destinations, tolerating a JSON string, an array, an empty
 * field, and legacy accounts that only ever had `review_link`.
 */
export function parseReviewDestinations(user: {
  review_destinations?: unknown;
  review_link?: string | undefined;
}): UserReviewDestination[] {
  let raw: unknown = user.review_destinations;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) raw = undefined;
    else {
      try {
        raw = JSON.parse(text);
      } catch {
        raw = undefined;
      }
    }
  }

  const rows: UserReviewDestination[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const row = coerceRow(item);
      if (row && !rows.some((existing) => existing.id === row.id)) rows.push(row);
    }
  }

  // Legacy migration: an account with only review_link has a Google link,
  // because that is the only thing the old single field ever asked for.
  const legacy = (user.review_link ?? "").trim();
  if (legacy) {
    const google = rows.find((row) => row.id === "google");
    if (!google) rows.unshift({ id: "google", url: legacy, enabled: true });
    else if (!google.url) google.url = legacy;
  }

  return rows;
}

/** Enabled destinations that actually have a URL, in saved order. */
export function activeReviewDestinations(
  rows: UserReviewDestination[],
): UserReviewDestination[] {
  return rows.filter((row) => row.enabled && row.url.trim() !== "");
}

/**
 * The URL written to `review_link`: the first active destination, so existing
 * single-link automations keep working after a business adds more.
 */
export function primaryReviewUrl(rows: UserReviewDestination[]): string {
  return activeReviewDestinations(rows)[0]?.url ?? "";
}

/** Map of destination id -> URL for every active destination. */
export function reviewUrlMap(rows: UserReviewDestination[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of activeReviewDestinations(rows)) map[row.id] = row.url;
  return map;
}

/**
 * The literal text block a business can paste into a review-request message.
 *
 * Real URLs, not placeholders: the message is rendered by the existing email
 * action, which has no knowledge of destinations, so the links must already be
 * present in the body text.
 */
export function reviewLinksText(
  rows: UserReviewDestination[],
  names: Record<string, string>,
): string {
  return activeReviewDestinations(rows)
    .map((row) => `${names[row.id] ?? row.id}: ${row.url}`)
    .join("\n");
}

/** The PocketBase update payload for a destination list. */
export function reviewDestinationsPayload(rows: UserReviewDestination[]): {
  review_destinations: string;
  review_link: string;
} {
  const cleaned = rows
    .filter((row) => row.url.trim() !== "")
    .map((row) => ({ id: row.id, url: row.url.trim(), enabled: row.enabled }));
  return {
    review_destinations: JSON.stringify(cleaned),
    review_link: primaryReviewUrl(cleaned),
  };
                               }
