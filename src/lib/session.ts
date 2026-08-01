export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const TIMEOUT_WARNING_MS = 2 * 60 * 1000; // warn 2 minutes before

const ACTIVITY_KEY = "synkra-last-activity";

let timeoutRef: ReturnType<typeof setTimeout> | null = null;
let warningRef: ReturnType<typeof setTimeout> | null = null;
let onWarningCallback: (() => void) | null = null;
let onLogoutCallback: (() => void) | null = null;

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"] as const;

export function initSession(onWarning: () => void, onLogout: () => void): void {
  if (typeof window === "undefined") return;
  onWarningCallback = onWarning;
  onLogoutCallback = onLogout;
  resetActivity();

  EVENTS.forEach((event) => {
    document.addEventListener(event, resetActivity, { passive: true });
  });
}

export function teardownSession(): void {
  if (typeof window === "undefined") return;
  EVENTS.forEach((event) => document.removeEventListener(event, resetActivity));
  if (timeoutRef) clearTimeout(timeoutRef);
  if (warningRef) clearTimeout(warningRef);
  onWarningCallback = null;
  onLogoutCallback = null;
}

export function resetActivity(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
  if (timeoutRef) clearTimeout(timeoutRef);
  if (warningRef) clearTimeout(warningRef);

  warningRef = setTimeout(() => {
    onWarningCallback?.();
  }, SESSION_TIMEOUT_MS - TIMEOUT_WARNING_MS);

  timeoutRef = setTimeout(() => {
    destroySession();
    onLogoutCallback?.();
  }, SESSION_TIMEOUT_MS);
}

export function destroySession(): void {
  if (timeoutRef) clearTimeout(timeoutRef);
  if (warningRef) clearTimeout(warningRef);
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVITY_KEY);
}

export function getLastActivity(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(ACTIVITY_KEY) || "0", 10);
}

export function isSessionExpired(): boolean {
  const last = getLastActivity();
  if (!last) return true;
  return Date.now() - last > SESSION_TIMEOUT_MS;
}
