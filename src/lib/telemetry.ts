// In-memory telemetry event log.
// Used by src/components/portal/diagnostics-panel.tsx to surface
// notification deliveries and realtime connection issues to admins.

export type TelemetryLevel = "info" | "warn" | "error";

export interface TelemetryEvent {
  id: string;
  at: number;
  category: string;
  level: TelemetryLevel;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_EVENTS = 200;

let events: TelemetryEvent[] = [];
const subscribers = new Set<(events: TelemetryEvent[]) => void>();

function notify(): void {
  const snapshot = getTelemetry();
  subscribers.forEach((callback) => callback(snapshot));
}

export function logTelemetry(
  category: string,
  level: TelemetryLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const event: TelemetryEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: Date.now(),
    category,
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  events = [event, ...events].slice(0, MAX_EVENTS);
  notify();
}

export function getTelemetry(): TelemetryEvent[] {
  return events;
}

export function subscribeTelemetry(
  callback: (events: TelemetryEvent[]) => void
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function clearTelemetry(): void {
  events = [];
  notify();
}

export function summarizeTelemetry(list: TelemetryEvent[]): {
  notificationsSent: number;
  notificationsFailed: number;
  realtimeErrors: number;
  total: number;
} {
  let notificationsSent = 0;
  let notificationsFailed = 0;
  let realtimeErrors = 0;

  for (const event of list) {
    if (event.category === "notification" && event.level === "info") {
      notificationsSent += 1;
    } else if (event.category === "notification" && event.level === "error") {
      notificationsFailed += 1;
    } else if (event.category === "realtime" && event.level === "error") {
      realtimeErrors += 1;
    }
  }

  return {
    notificationsSent,
    notificationsFailed,
    realtimeErrors,
    total: list.length,
  };
}

// Kept for any legacy call sites; no-op passthrough onto the log.
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  logTelemetry("event", "info", name, props);
}
