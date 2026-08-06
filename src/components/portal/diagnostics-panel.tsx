import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  clearTelemetry,
  getTelemetry,
  subscribeTelemetry,
  summarizeTelemetry,
  type TelemetryEvent,
} from "@/lib/telemetry";
import { POCKETBASE_URL } from "@/lib/pocketbase";

const levelColor: Record<string, string> = {
  info: "var(--text-secondary)",
  warn: "var(--state-warning, #f59e0b)",
  error: "var(--state-error)",
};

export function DiagnosticsPanel() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);

  useEffect(() => {
    setEvents(getTelemetry());
    return subscribeTelemetry(setEvents);
  }, []);

  const counts = summarizeTelemetry(events);
  const metrics = [
    { label: "Emails sent", value: counts.notificationsSent },
    { label: "Emails failed", value: counts.notificationsFailed },
    { label: "Realtime errors", value: counts.realtimeErrors },
    { label: "Total events", value: counts.total },
  ];

  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Diagnostics</div>
          <p className="mt-1" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Backend: {POCKETBASE_URL}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="synkra-focus inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5"
            style={{
              borderColor: "var(--border-default)",
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
            onClick={() => setEvents(getTelemetry())}
          >
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </button>
          <button
            type="button"
            className="synkra-focus inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5"
            style={{
              borderColor: "var(--border-default)",
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
            onClick={() => clearTelemetry()}
          >
            <Trash2 size={13} aria-hidden="true" /> Clear
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-md border p-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>{metric.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No events recorded yet. Notification deliveries and realtime connection problems appear
            here as they happen.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-md border p-3"
                style={{ borderColor: "var(--border-default)" }}
              >
                <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(event.at).toLocaleString("en-ZA")}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{event.category}</span>
                  <span style={{ color: levelColor[event.level], fontWeight: 600 }}>
                    {event.level}
                  </span>
                </div>
                <div className="mt-1" style={{ fontSize: 13 }}>
                  {event.message}
                </div>
                {event.meta && (
                  <pre
                    className="mt-2 overflow-x-auto rounded p-2"
                    style={{
                      backgroundColor: "var(--bg-input)",
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    {JSON.stringify(event.meta, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
