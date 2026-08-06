// Lightweight client-side telemetry ring buffer used by the Diagnostics panel.
// Captures notification delivery results and PocketBase subscription errors so
// issues can be triaged from inside the portal without server access.

export type TelemetryLevel = "info" | "warn" | "error";
export type TelemetryCategory = "notification" | "realtime" | "auth" | "workflow" | "query";

export interface TelemetryEvent {
  id: string;
  at: string;
  level: TelemetryLevel;
  category: TelemetryCategory;
  message: string;
  meta?: Record<string, unknown>;
}

const STORAGE_KEY = "synkra-telemetry";
const MAX_EVENTS = 100;

type Listener = (events: TelemetryEvent[]) => void;
const listeners = new Set<Listener>();

function read(): TelemetryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: TelemetryEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // storage full or unavailable, telemetry is best effort
  }
  listeners.forEach((listener) => listener(events.slice(0, MAX_EVENTS)));
}

export function logTelemetry(
  category: TelemetryCategory,
  level: TelemetryLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const event: TelemetryEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level,
    category,
    message,
    ...(meta ? { meta } : {}),
  };
  write([event, ...read()]);
  const line = `[synkra:${category}] ${message}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.info(line, meta ?? "");
}

export function getTelemetry(): TelemetryEvent[] {
  return read();
}

export function clearTelemetry(): void {
  write([]);
}

export function subscribeTelemetry(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface TelemetryCounts {
  total: number;
  errors: number;
  notificationsSent: number;
  notificationsFailed: number;
  realtimeErrors: number;
}

export function summarizeTelemetry(events: TelemetryEvent[]): TelemetryCounts {
  return {
    total: events.length,
    errors: events.filter((e) => e.level === "error").length,
    notificationsSent: events.filter((e) => e.category === "notification" && e.level === "info")
      .length,
    notificationsFailed: events.filter((e) => e.category === "notification" && e.level === "error")
      .length,
    realtimeErrors: events.filter((e) => e.category === "realtime" && e.level === "error").length,
  };
}
