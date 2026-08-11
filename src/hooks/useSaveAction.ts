import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export interface SaveMessages {
  /** Shown while the request is in flight. */
  pending?: string;
  /** Shown only after the backend confirms success. */
  success?: string;
  /** Fallback shown when the request fails without a usable message. */
  error?: string;
}

const DEFAULTS: Required<SaveMessages> = {
  pending: "Saving…",
  success: "Saved successfully",
  error: "Could not save your changes. Please try again.",
};

/**
 * Shared save-feedback abstraction for every user initiated
 * create/update/delete in the portal.
 *
 * - Shows a pending toast immediately.
 * - Blocks duplicate submissions while a request is in flight.
 * - Replaces the pending toast with success ONLY after the promise resolves,
 *   or with an error message when it rejects.
 *
 * Errors thrown by the action are surfaced with their own message when they
 * carry one, so callers can throw a specific, user-safe reason.
 */
export function useSaveAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  messages: SaveMessages = {},
) {
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const latest = useRef({ action, messages });
  latest.current = { action, messages };

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (inFlight.current) return undefined;
    const { action: fn, messages: copy } = latest.current;
    inFlight.current = true;
    setSaving(true);
    const id = toast.loading(copy.pending ?? DEFAULTS.pending);
    try {
      const result = await fn(...args);
      toast.success(copy.success ?? DEFAULTS.success, { id });
      return result;
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : (copy.error ?? DEFAULTS.error);
      toast.error(message, { id });
      return undefined;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  return { run, saving };
}
