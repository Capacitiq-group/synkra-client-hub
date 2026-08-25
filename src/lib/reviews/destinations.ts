/**
 * Review destination catalog — SINGLE SOURCE OF TRUTH for review-request
 * automation targets.
 *
 * Rules for this file (same spirit as src/lib/integrations/catalog.ts):
 * - A destination describes WHERE a customer can be sent to leave a review.
 *   Review requests are outbound messages containing a link, so any
 *   destination with a public review URL is supported by the existing email
 *   automation without a platform integration.
 * - `crossPost` describes whether Synkra may programmatically PUBLISH review
 *   content onto that platform. It must record a real check of that platform's
 *   API/terms, with the source consulted and the date. `"unverified"` is the
 *   only honest value until that check has actually been done — never assume a
 *   review can be duplicated from one destination to another.
 * - Nothing in this module performs cross-posting. `canAutoCrossPost()` exists
 *   so any future implementation is forced through the recorded policy.
 */

export const REVIEW_DESTINATION_IDS = [
  "google",
  "hellopeter",
  "own_website",
  "facebook",
  "trustpilot",
] as const;

export type ReviewDestinationId = (typeof REVIEW_DESTINATION_IDS)[number];

/**
 * How a review request reaches this destination today.
 * - "link": the request email/message carries the destination's review URL.
 *   This works now, with no platform integration.
 * - "widget": the review is collected on a surface Synkra renders. Not built.
 */
export type ReviewRequestMethod = "link" | "widget";

export type CrossPostStatus =
  /** The platform's API/terms were checked and publishing is not available. */
  | "verified_not_permitted"
  /** The platform's API/terms were checked and publishing is available. */
  | "verified_permitted"
  /** No check has been done yet. Treated exactly like "not permitted". */
  | "unverified";

export interface CrossPostPolicy {
  status: CrossPostStatus;
  /** ISO date (UTC) the source below was read. Absent when unverified. */
  checkedOn?: string;
  /** Documentation actually consulted for this decision. */
  sources: string[];
  /** Plain-language finding, shown in the UI. */
  finding: string;
}

export interface ReviewDestinationDefinition {
  id: ReviewDestinationId;
  name: string;
  /** One line for the settings row. */
  summary: string;
  /** How a request currently reaches this destination. */
  requestMethod: ReviewRequestMethod;
  /**
   * True when a business can use this destination right now by saving its
   * review URL. False when the destination is listed for architecture and
   * visibility only.
   */
  linkSupported: boolean;
  linkLabel: string;
  linkPlaceholder: string;
  /** Hostnames the URL normally lives on. Used for a soft warning only. */
  expectedHosts?: string[];
  crossPost: CrossPostPolicy;
  /** Extra facts for the settings row. */
  notes?: string[];
}

export const REVIEW_DESTINATIONS: ReviewDestinationDefinition[] = [
  {
    id: "google",
    name: "Google",
    summary: "Send customers to your Google Business Profile review form.",
    requestMethod: "link",
    linkSupported: true,
    linkLabel: "Google review link",
    linkPlaceholder: "https://g.page/r/your-google-review-link",
    expectedHosts: ["g.page", "google.com", "goo.gl", "maps.app.goo.gl", "search.google.com"],
    crossPost: {
      status: "verified_not_permitted",
      checkedOn: "2026-08-25",
      sources: [
        "https://developers.google.com/my-business/content/review-data",
        "https://developers.google.com/my-business/content/policies",
      ],
      finding:
        "The Google Business Profile API exposes reviews for listing, reading, replying and deleting only. There is no endpoint that creates a review, so a review collected elsewhere cannot be published to Google. Customers must submit it themselves through the review link.",
    },
    notes: [
      "Requests are sent as a link in the review-request automation — no Google integration needed.",
      "Only the customer can publish the review on Google.",
    ],
  },
  {
    id: "hellopeter",
    name: "Hellopeter",
    summary: "Send customers to your Hellopeter business page to review you.",
    requestMethod: "link",
    linkSupported: true,
    linkLabel: "Hellopeter business page link",
    linkPlaceholder: "https://www.hellopeter.com/your-business",
    expectedHosts: ["hellopeter.com", "www.hellopeter.com", "business.hellopeter.com"],
    crossPost: {
      status: "verified_not_permitted",
      checkedOn: "2026-08-25",
      sources: [
        "https://business.hellopeter.com/docs/api/v5/reviews",
        "https://business.hellopeter.com/docs/api/v5/replies",
      ],
      finding:
        "The Hellopeter Business API v5 documents the reviews resource as GET-only (list and detail); writes are limited to replies on an existing review. There is no review-creation endpoint, so reviews cannot be duplicated onto Hellopeter.",
    },
    notes: [
      "Requests are sent as a link — the Hellopeter API key is not required for this.",
      "Reading reviews or auto-replying would need a Hellopeter Business API key and is not built.",
    ],
  },
  {
    id: "own_website",
    name: "Your own website",
    summary: "Collect a review on your own site with an embeddable widget.",
    requestMethod: "widget",
    linkSupported: false,
    linkLabel: "Review page on your website",
    linkPlaceholder: "https://yourbusiness.co.za/leave-a-review",
    crossPost: {
      status: "unverified",
      sources: [],
      finding:
        "A review submitted on your own website is your own data, so republishing it on your site is your decision. Pushing it onward to Google or Hellopeter is still blocked by those platforms — see their entries.",
    },
    notes: [
      "The embeddable widget and its submission endpoint are not built yet.",
      "Nothing is collected or displayed on your website today.",
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    summary: "Listed for visibility. Facebook recommendations are not wired up.",
    requestMethod: "link",
    linkSupported: false,
    linkLabel: "Facebook page reviews link",
    linkPlaceholder: "https://www.facebook.com/yourpage/reviews",
    expectedHosts: ["facebook.com", "www.facebook.com", "fb.com"],
    crossPost: {
      status: "unverified",
      sources: [],
      finding:
        "Facebook's Graph API terms for recommendations have not been checked yet. Until that check is done, Synkra treats publishing to Facebook as not permitted.",
    },
    notes: ["No Facebook automation exists in this codebase."],
  },
  {
    id: "trustpilot",
    name: "Trustpilot",
    summary: "Listed for visibility. Trustpilot invitations are not wired up.",
    requestMethod: "link",
    linkSupported: false,
    linkLabel: "Trustpilot review link",
    linkPlaceholder: "https://www.trustpilot.com/evaluate/yourbusiness.co.za",
    expectedHosts: ["trustpilot.com", "www.trustpilot.com"],
    crossPost: {
      status: "unverified",
      sources: [],
      finding:
        "Trustpilot's invitation API and its terms have not been checked yet. Until that check is done, Synkra treats publishing to Trustpilot as not permitted.",
    },
    notes: ["No Trustpilot automation exists in this codebase."],
  },
];

export function findReviewDestination(
  id?: string | undefined,
): ReviewDestinationDefinition | undefined {
  if (!id) return undefined;
  return REVIEW_DESTINATIONS.find((destination) => destination.id === id);
}

export function isReviewDestinationId(value: unknown): value is ReviewDestinationId {
  return typeof value === "string" && REVIEW_DESTINATION_IDS.includes(value as ReviewDestinationId);
}

/** Destinations a business can actually use today by saving a review URL. */
export function linkSupportedDestinations(): ReviewDestinationDefinition[] {
  return REVIEW_DESTINATIONS.filter((destination) => destination.linkSupported);
}

/**
 * The single gate any future cross-posting code must call.
 *
 * Returns false unless the destination's policy has been verified as
 * permitting programmatic publishing. "unverified" is never treated as a yes.
 */
export function canAutoCrossPost(id: ReviewDestinationId): {
  allowed: boolean;
  reason: string;
} {
  const destination = findReviewDestination(id);
  if (!destination) return { allowed: false, reason: `Unknown review destination "${id}".` };
  if (destination.crossPost.status === "verified_permitted") {
    return { allowed: true, reason: destination.crossPost.finding };
  }
  return { allowed: false, reason: destination.crossPost.finding };
}

export interface UrlCheck {
  ok: boolean;
  /** Present when the URL is unusable, or when it is usable but suspicious. */
  message?: string;
  /** True when the message is advisory rather than blocking. */
  warning?: boolean;
}

/** Validates a destination URL with the URL parser — http(s) only. */
export function checkReviewUrl(id: ReviewDestinationId, value: string): UrlCheck {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: "Add the link customers should open." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: "That is not a complete web address. Include https://" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "The link must start with https://" };
  }

  const destination = findReviewDestination(id);
  const hosts = destination?.expectedHosts;
  if (hosts && hosts.length) {
    const host = parsed.hostname.toLowerCase();
    const matches = hosts.some((expected) => host === expected || host.endsWith(`.${expected}`));
    if (!matches) {
      return {
        ok: true,
        warning: true,
        message: `This does not look like a ${destination?.name} address. Double-check it opens the review form.`,
      };
    }
  }
  return { ok: true };
}
