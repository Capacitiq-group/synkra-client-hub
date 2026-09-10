// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import pb, { describeConnectionProblem, isNetworkFailure } from "./pocketbase";
import { sanitizeEmail } from "./sanitize";
import { checkRateLimit, clearRateLimit } from "./rateLimit";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  business_name: string;
  business_industry?: string;
  business_address?: string;
  whatsapp_number?: string;
  review_link?: string;
  /** JSON array of review destinations; review_link stays as legacy fallback. */
  review_destinations?: unknown;
  notification_email?: string;
  is_tester?: boolean;
  user_type: "beta" | "paid";
  trial_ends_at: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  credit_emails: number;
  credit_emails_used: number;
  credit_workflows: number;
  credit_workflows_used: number;
  /** Subscription tier — see src/lib/plans.ts for the limits attached to it. */
  tier?: "free" | "basic" | "pro";
  /** Section 4 (28 Aug 2026) — drives getEffectivePriceZar(). Server-owned. */
  student_verified?: boolean;
  student_verification_status?: "none" | "pending" | "approved" | "rejected";
  executions_used_this_month?: number;
  ai_ops_used_this_month?: number;
  storage_used_mb?: number;
  emails_used_this_month?: number;
  billing_period_start?: string | null;
  notify_on_failure?: boolean;
  notify_weekly_summary?: boolean;
  notify_on_success?: boolean;
  notify_credit_low?: boolean;
  notify_platform_updates?: boolean;
  created?: string;
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
    if (isNetworkFailure(err)) return { success: false, error: "unreachable" };
    const message = err instanceof Error ? err.message : "";
    if (/not verified|verify/i.test(message)) return { success: false, error: "not_verified" };
    if (/suspend|disabled|banned/i.test(message)) return { success: false, error: "suspended" };
    if (/failed to authenticate|invalid/i.test(message)) {
      return { success: false, error: "invalid_credentials" };
    }
    return { success: false, error: "unknown" };
  }
}

export function connectionProblemMessage(): string {
  return describeConnectionProblem();
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
