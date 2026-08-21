import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Database } from "lucide-react";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import {
  collectColumns,
  formatCell,
  summariseCollections,
  useSavedRecords,
} from "@/hooks/useSavedData";
import { relativeTime } from "@/lib/utils/time";

export const Route = createFileRoute("/dashboard/data")({
  validateSearch: (search: Record<string, unknown>): { collection?: string } =>
    typeof search["collection"] === "string" && search["collection"]
      ? { collection: search["collection"] }
      : {},
  head: () => ({
    meta: [
      { title: "Saved data — Synkra Client Portal" },
      {
        name: "description",
        content: "Browse the records your workflows have saved, grouped by collection.",
      },
      { property: "og:title", content: "Saved data — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Browse the records your workflows have saved, grouped by collection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SavedDataPage,
});

function SavedDataPage() {
  const { collection } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSavedRecords();

  const records = data ?? [];
  const collections = useMemo(() => summariseCollections(records), [records]);
  const selected = useMemo(
    () => (collection ? records.filter((r) => r.collection === collection) : []),
    [records, collection],
  );
  const columns = useMemo(() => collectColumns(selected), [selected]);

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Saved data</h1>
      <p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>
        Everything your workflows have saved with the “Save information” step. Read-only for now.
      </p>

      {isLoading ? (
        <div className="mt-8 space-y-3">
          <Shimmer height={56} />
          <Shimmer height={56} />
          <Shimmer height={56} />
        </div>
      ) : isError ? (
        <div className="mt-8">
          <SectionError label="your saved data" onRetry={() => void refetch()} />
        </div>
      ) : collection ? (
        <div className="mt-8">
          <button
            type="button"
            className="synkra-focus mb-4 flex items-center gap-2 rounded-sm text-sm"
            style={{ color: "var(--accent-green)" }}
            onClick={() => navigate({ to: "/dashboard/data", search: {} })}
          >
            <ArrowLeft size={16} aria-hidden="true" /> All collections
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{collection}</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {selected.length} {selected.length === 1 ? "record" : "records"}
          </p>

          {selected.length === 0 ? (
            <EmptyState message="No records in this collection." />
          ) : (
            <div
              className="mt-5 overflow-x-auto rounded-md border"
              style={{ borderColor: "var(--border-default)" }}
            >
              <table className="w-full border-collapse" style={{ fontSize: 14 }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-subtle, transparent)" }}>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="whitespace-nowrap px-3 py-2 text-left"
                        style={{
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          borderBottom: "1px solid var(--border-default)",
                        }}
                      >
                        {column}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 text-left"
                      style={{
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      Saved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((record) => (
                    <tr key={record.id}>
                      {columns.map((column) => (
                        <td
                          key={column}
                          className="px-3 py-2 align-top"
                          style={{ borderTop: "1px solid var(--border-default)" }}
                        >
                          {formatCell(record.fields?.[column])}
                        </td>
                      ))}
                      <td
                        className="whitespace-nowrap px-3 py-2 align-top"
                        style={{
                          borderTop: "1px solid var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {record.updated ? relativeTime(new Date(record.updated)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : collections.length === 0 ? (
        <EmptyState message="No saved data yet. Add a “Save information” step to a workflow and its records will show up here." />
      ) : (
        <ul className="mt-8 space-y-3">
          {collections.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                className="synkra-focus flex w-full items-center gap-3 rounded-md border p-4 text-left"
                style={{ borderColor: "var(--border-default)" }}
                onClick={() =>
                  navigate({ to: "/dashboard/data", search: { collection: item.name } })
                }
              >
                <Database size={18} style={{ color: "var(--accent-green)" }} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block" style={{ fontWeight: 600 }}>
                    {item.name}
                  </span>
                  <span className="block text-sm" style={{ color: "var(--text-muted)" }}>
                    {item.count} {item.count === 1 ? "record" : "records"}
                    {item.lastUpdated ? ` · updated ${relativeTime(new Date(item.lastUpdated))}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="mt-6 rounded-md border p-6 text-sm"
      style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
    >
      {message}
    </div>
  );
}
