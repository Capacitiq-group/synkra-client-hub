/** Maps common execution errors to a plain language explanation. */
export function explainError(message: string): string | null {
  const text = message.toLowerCase();
  if (text.includes("401") || text.includes("unauthorized")) {
    return "Your API credentials for this step have expired or are incorrect. Go to Settings to reconnect.";
  }
  if (text.includes("404") || text.includes("not found")) {
    return "The record or resource this step was looking for does not exist.";
  }
  if (text.includes("econnrefused")) {
    return "The service this step is trying to reach is not responding. This may be temporary.";
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return "This step took too long to respond. It will be retried automatically.";
  }
  if (text.includes("missing required field")) {
    return "A required value was not available at this step. Check the previous steps are providing the expected output.";
  }
  return null;
}

export function needsReconnect(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("401") || text.includes("unauthorized");
}

/** 3 Aug 2026 at 14:32:07 */
export function fullDateTime(date: Date): string {
  const day = date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${day} at ${time}`;
}
