// Captures the most recent server-side error so that catch-all SSR error
// handling (see src/server.ts) can log the *real* underlying error even in
// cases where h3 swallows it into a generic 500 JSON response.

let lastCapturedError: unknown;

export function captureError(error: unknown, context?: string): void {
  lastCapturedError = error;
  console.error(context || "Error:", error);
}

export function consumeLastCapturedError(): unknown {
  const error = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

// Side-effect import (`import "./lib/error-capture"`) wires these up so
// that even errors thrown outside our own try/catch blocks get captured.
if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("uncaughtException", (error) => captureError(error, "uncaughtException"));
  process.on("unhandledRejection", (error) => captureError(error, "unhandledRejection"));
}
