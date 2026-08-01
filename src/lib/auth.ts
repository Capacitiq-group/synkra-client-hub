// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import pb from "./pocketbase";
import { sanitizeEmail } from "./sanitize";
import { checkRateLimit, clearRateLimit } from "./rateLimit";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  business_name: string;
  business_industry?: string;
  user_type: "beta" | "paid";
  trial_ends_at: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  credit_emails: number;
  credit_emails_used: number;
  credit_workflows: number;
  credit_workflows_used: number;
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
  const cleanEmail = sanitizeEmail(email);

  const rl = checkRateLimit(`login-${cleanEmail}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.remainingMs / 60000);
    return { success: false, error: `rate_limited:${minutes}` };
  }

  try {
    const result = await pb.collection("users").authWithPassword(cleanEmail, password);
    clearRateLimit(`login-${cleanEmail}`);
    return { success: true, user: result.record as unknown as AuthUser };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not verified|verify/i.test(message)) return { success: false, error: "not_verified" };
    if (/suspend|disabled|banned/i.test(message)) return { success: false, error: "suspended" };
    if (/failed to authenticate|invalid/i.test(message)) {
      return { success: false, error: "invalid_credentials" };
    }
    return { success: false, error: "unknown" };
  }
}

export async function signOut(): Promise<void> {
  pb.authStore.clear();
}

export function getCurrentUser(): AuthUser | null {
  if (!pb.authStore.isValid) return null;
  return (pb.authStore.record as unknown as AuthUser) ?? null;
}

export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

/** Fire-and-forget user record update with a single silent retry. */
export function saveUserFields(userId: string, data: Record<string, unknown>): void {
  const attempt = (retries: number) => {
    pb.collection("users")
      .update(userId, data)
      .catch(() => {
        if (retries > 0) setTimeout(() => attempt(retries - 1), 2000);
      });
  };
  attempt(1);
}
