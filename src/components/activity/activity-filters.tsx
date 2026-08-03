import type { RunFilters } from "@/hooks/useActivityRuns";

const selectStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: 13,
  padding: "8px 10px",
};

export const DEFAULT_FILTERS: Required<Pick<RunFilters, "status" | "dateRange">> = {
  status: "all",
  dateRange: "7days",
};

export function ActivityFilters({
  filters,
  workflows,
  onChange,
  onClear,
}: {
  filters: RunFilters;
  workflows: { id: string; name: string }[];
  onChange: (next: RunFilters) => void;
  onClear: () => void;
}) {
  const dirty =
    Boolean(filters.workflowId) ||
    (filters.status ?? "all") !== "all" ||
    (filters.dateRange ?? "7days") !== "7days";

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        aria-label="Filter by workflow"
        value={filters.workflowId ?? ""}
        onChange={(e) => onChange({ ...filters, workflowId: e.target.value || undefined })}
        className="synkra-focus w-full sm:w-[220px]"
        style={selectStyle}
      >
        <option value="">All workflows</option>
        {workflows.map((workflow) => (
          <option key={workflow.id} value={workflow.id}>
            {workflow.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by status"
        value={filters.status ?? "all"}
        onChange={(e) => onChange({ ...filters, status: e.target.value as RunFilters["status"] })}
        className="synkra-focus w-full sm:w-[160px]"
        style={selectStyle}
      >
        <option value="all">All</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
        <option value="running">Running</option>
      </select>

      <select
        aria-label="Filter by date range"
        value={filters.dateRange ?? "7days"}
        onChange={(e) =>
          onChange({ ...filters, dateRange: e.target.value as RunFilters["dateRange"] })
        }
        className="synkra-focus w-full sm:w-[160px]"
        style={selectStyle}
      >
        <option value="today">Today</option>
        <option value="7days">Last 7 days</option>
        <option value="30days">Last 30 days</option>
        <option value="all">All time</option>
      </select>

      {dirty && (
        <button
          type="button"
          onClick={onClear}
          className="synkra-focus self-start rounded-sm sm:ml-auto"
          style={{ fontSize: 13, color: "var(--accent-green)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function StatsSummaryBar({
  counts,
}: {
  counts: { total: number; success: number; failed: number; running: number };
}) {
  const items = [
    { label: "Total runs", value: counts.total, color: "var(--text-primary)", pulse: false },
    { label: "Successful", value: counts.success, color: "var(--state-success)", pulse: false },
    {
      label: "Failed",
      value: counts.failed,
      color: counts.failed > 0 ? "var(--state-error)" : "var(--text-muted)",
      pulse: false,
    },
    {
      label: "Running",
      value: counts.running,
      color: "var(--state-info)",
      pulse: counts.running > 0,
    },
  ];

  return (
    <div
      className="mb-5 flex flex-wrap items-center"
      style={{
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "12px 0",
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className="pr-6"
          style={{
            paddingLeft: index === 0 ? 0 : 24,
            borderLeft: index === 0 ? "none" : "1px solid var(--border-subtle)",
          }}
        >
          <div
            className={item.pulse ? "synkra-pulse-scale" : undefined}
            style={{ fontSize: 20, fontWeight: 700, color: item.color, width: "fit-content" }}
          >
            {item.value}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
