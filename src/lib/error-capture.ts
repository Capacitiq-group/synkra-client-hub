export function captureError(error: unknown, context?: string): void {
  console.error(context || "Error:", error);
}}
