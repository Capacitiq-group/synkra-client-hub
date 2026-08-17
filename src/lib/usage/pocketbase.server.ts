/**
 * Server-side PocketBase access for usage accounting and limit enforcement.
 *
 * The browser must never be trusted with usage counters, so every counter read
 * and write goes through a superuser client created here. Credentials are read
 * from runtime env inside the functions (never at module scope) and never
 * shipped to the browser bundle.
 */
import PocketBase from "pocketbase";

export function pocketbaseUrl(): string {
  return (
    process.env["POCKETBASE_URL"] ||
    process.env["VITE_POCKETBASE_URL"] ||
    "http://127.0.0.1:8090"
  ).replace(/\/+$/, "");
}

/** A superuser-authenticated PocketBase client. Server use only. */
export async function adminClient(): Promise<PocketBase> {
  const email = process.env["PB_ADMIN_EMAIL"] || "";
  const password = process.env["PB_ADMIN_PASSWORD"] || "";
  if (!email || !password) {
    throw new Error("Usage enforcement is not configured on the server.");
  }
  const pb = new PocketBase(pocketbaseUrl());
  pb.autoCancellation(false);
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch {
    await (
      pb as unknown as {
        admins: { authWithPassword: (e: string, p: string) => Promise<unknown> };
      }
    ).admins.authWithPassword(email, password);
  }
  return pb;
}

/**
 * Verifies a PocketBase auth token sent by the browser and returns the user id.
 * Used so client-initiated actions are enforced against the real account, not
 * an id the browser claims to own.
 */
export async function verifyUserToken(token: string): Promise<{ userId: string }> {
  if (!token) throw new Error("Not authenticated");
  const pb = new PocketBase(pocketbaseUrl());
  pb.autoCancellation(false);
  pb.authStore.save(token, null);
  try {
    const result = await pb.collection("users").authRefresh();
    const id = (result.record as { id?: string } | undefined)?.id;
    if (!id) throw new Error("Not authenticated");
    return { userId: id };
  } catch {
    throw new Error("Not authenticated");
  }
}
