/**
 * Retries a connection-status check with a short delay between attempts.
 *
 * Nango's Connect UI "connect" event fires once the popup's own OAuth
 * flow visually completes, but the resulting connection record on
 * Nango's side can take a moment longer to actually become queryable
 * through its REST API. Checking exactly once, immediately, can race
 * this: the OAuth itself genuinely succeeded, but our own status check
 * asks a beat too early, gets a 404/null connection back, and reports
 * "did not report a connection" even though the user did everything
 * right. This affects Slack, HubSpot, and Zoho equally, since all three
 * use the same Nango-based connect flow and previously all checked
 * status exactly once with no retry.
 *
 * Up to 4 attempts, 1 second apart (so up to ~3 seconds of grace period
 * after the first immediate check) before genuinely giving up and
 * reporting not-connected.
 */
export async function confirmConnectionWithRetry<T extends { connected: boolean }>(
  check: () => Promise<T>,
  attempts = 4,
  delayMs = 1000,
): Promise<T> {
  let last: T | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await check();
    if (last.connected) return last;
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return last as T;
}
