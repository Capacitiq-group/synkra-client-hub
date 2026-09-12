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
 * right. This affects Slack, HubSpot, Zoho, and all ten
 * oauth_integration_factory.py providers equally, since every one of
 * them uses the same Nango-based connect flow behind this same retry.
 *
 * Up to 8 attempts, 1.5 seconds apart (so up to ~10.5 seconds of grace
 * period after the first immediate check) before genuinely giving up
 * and reporting not-connected. The previous defaults (4 attempts, 1s
 * apart, ~3s total) were a guess made without measuring the actual lag
 * on our self-hosted Nango instance, and 3 seconds is thin enough that
 * a burst of simultaneous connects, a moment of DB contention, or just
 * ordinary variance can plausibly exceed it. If real retry-sequence
 * logs ever show a consistent number of attempts needed to succeed,
 * use that distribution to pick a better number than this one — this
 * is still a reasoned guess, not a measurement.
 *
 * IMPORTANT — why a thrown error is never retried here:
 * Every /integrations/{provider}/status endpoint on the backend
 * (routers/integrations_hubspot.py, integrations_slack.py,
 * integrations_zoho.py, oauth_integration_factory.py) already
 * distinguishes "Nango confirms no such connection exists yet" from
 * "we genuinely couldn't find out" — see services/nango_client.py's
 * get_connection(), which returns `None` for a real 404 but raises
 * NangoUnavailableError for a timeout/network failure/5xx/missing
 * secret key. Each status endpoint turns that into two different HTTP
 * outcomes: a confirmed-absent connection is a normal 200 response
 * with `{"connected": false}`, while a genuine failure to confirm
 * raises HTTPException(503). fetchHubspotStatus/fetchSlackStatus/
 * fetchZohoStatus/fetchProviderStatus (lib/workflow/api.ts) throw on
 * any non-2xx response — so a 503 throws, and that throw is NOT caught
 * inside the loop below, which means it propagates out of
 * confirmConnectionWithRetry immediately, on the very first attempt.
 * A `{"connected": false}` 200 response, by contrast, doesn't throw —
 * it just fails the `last.connected` check and the loop waits and
 * tries again.
 *
 * That split is exactly the "back off longer for not-found-yet, bail
 * immediately on a real error" behavior — it does not need a separate
 * `reason` field threaded through the response shape, because the
 * distinction already exists as thrown-vs-returned. Do not add a
 * try/catch around `check()` inside this loop: doing so would swallow
 * that distinction and make every genuine failure wait out the full
 * ~10.5 second window instead of reporting fast, which is the one
 * thing we don't want to regress when raising these numbers.
 */
export async function confirmConnectionWithRetry<T extends { connected: boolean }>(
  check: () => Promise<T>,
  attempts = 8,
  delayMs = 1500,
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
