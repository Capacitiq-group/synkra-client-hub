// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import PocketBase from "pocketbase";
import { logTelemetry } from "./telemetry";

/**
 * The portal talks to a single PocketBase instance. The URL is baked in at
 * build time through VITE_POCKETBASE_URL (Coolify build argument). When the
 * argument is missing we fall back to the live Synkra instance instead of
 * localhost, so a misconfigured build still authenticates rather than failing
 * with a confusing "email or password is not correct" message.
 */
export const DEFAULT_POCKETBASE_URL = "http://167.86.106.152:8093";

const configured = (import.meta.env["VITE_POCKETBASE_URL"] as string | undefined)?.trim();

export const POCKETBASE_URL =
  configured && /^https?:\/\//.test(configured)
    ? configured.replace(/\/+$/, "")
    : DEFAULT_POCKETBASE_URL;

if (!configured) {
  console.warn(
    `[Synkra] VITE_POCKETBASE_URL is not set. Falling back to ${DEFAULT_POCKETBASE_URL}. ` +
      "Set it as a build argument in Coolify.",
  );
}

const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

/** Subscribes with consistent error telemetry so failures show in Diagnostics. */
export async function safeSubscribe(
  collection: string,
  topic: string,
  callback: (event: { action: string; record: Record<string, unknown> }) => void,
): Promise<() => void> {
  try {
    await pb.collection(collection).subscribe(topic, callback as never);
    logTelemetry("realtime", "info", `Subscribed to ${collection}`, { topic });
  } catch (err) {
    logTelemetry("realtime", "error", `Subscription to ${collection} failed`, {
      topic,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return () => {
    void pb
      .collection(collection)
      .unsubscribe(topic)
      .catch((err: unknown) => {
        logTelemetry("realtime", "warn", `Unsubscribe from ${collection} failed`, {
          topic,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  };
}

type ListOptions = Record<string, unknown>;

function isBadRequest(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { status?: number }).status === 400);
}

/**
 * PocketBase rejects a sort on a field a collection does not have (older
 * instances were created without the autodate created/updated fields). The
 * portal must still render, so a rejected sort is retried without it.
 */
export async function getFullListSafe<T = Record<string, unknown>>(
  collection: string,
  options: ListOptions = {},
): Promise<T[]> {
  try {
    return (await pb.collection(collection).getFullList(options)) as T[];
  } catch (err) {
    if (!isBadRequest(err) || !options["sort"]) throw err;
    const { sort, ...rest } = options;
    logTelemetry("query", "warn", `Sort "${String(sort)}" unsupported on ${collection}`, {});
    return (await pb.collection(collection).getFullList(rest)) as T[];
  }
}

export async function getListSafe<T = Record<string, unknown>>(
  collection: string,
  page: number,
  perPage: number,
  options: ListOptions = {},
): Promise<{ items: T[]; totalItems: number; totalPages: number; page: number }> {
  try {
    return (await pb.collection(collection).getList(page, perPage, options)) as unknown as {
      items: T[];
      totalItems: number;
      totalPages: number;
      page: number;
    };
  } catch (err) {
    if (!isBadRequest(err) || !options["sort"]) throw err;
    const { sort, ...rest } = options;
    logTelemetry("query", "warn", `Sort "${String(sort)}" unsupported on ${collection}`, {});
    return (await pb.collection(collection).getList(page, perPage, rest)) as unknown as {
      items: T[];
      totalItems: number;
      totalPages: number;
      page: number;
    };
  }
}

export default pb;

