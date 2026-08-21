// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb, { getFullListSafe } from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { parseJson } from "@/lib/workflow/types";

export interface SavedRecord {
  id: string;
  collection: string;
  natural_key?: string;
  fields: Record<string, unknown>;
  created: string;
  updated: string;
}

export interface SavedCollectionSummary {
  name: string;
  count: number;
  lastUpdated?: string;
}

function mapRecord(raw: Record<string, unknown>): SavedRecord {
  const naturalKey = (raw["natural_key"] as string) || "";
  return {
    id: raw["id"] as string,
    collection: (raw["collection"] as string) ?? "",
    ...(naturalKey ? { natural_key: naturalKey } : {}),
    fields: parseJson<Record<string, unknown>>(raw["fields"], {}),
    created: (raw["created"] as string) ?? "",
    updated: (raw["updated"] as string) ?? "",
  };
}

/** All saved workflow records for the signed-in user (read-only). */
export function useSavedRecords() {
  const { user } = useAuth();

  return useQuery<SavedRecord[]>({
    queryKey: ["workflow-records", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const records = await getFullListSafe<Record<string, unknown>>("workflow_records", {
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        sort: "-updated",
      });
      return records.map(mapRecord);
    },
  });
}

/** Distinct collection names the user has saved data under, with record counts. */
export function summariseCollections(records: SavedRecord[]): SavedCollectionSummary[] {
  const byName = new Map<string, SavedCollectionSummary>();
  for (const record of records) {
    const name = record.collection || "(unnamed)";
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, {
        name,
        count: 1,
        ...(record.updated ? { lastUpdated: record.updated } : {}),
      });
      continue;
    }
    existing.count += 1;
    if (record.updated && (!existing.lastUpdated || record.updated > existing.lastUpdated)) {
      existing.lastUpdated = record.updated;
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Union of every key present in the records' `fields` JSON, in first-seen order. */
export function collectColumns(records: SavedRecord[]): string[] {
  const columns: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record.fields ?? {})) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

/** Renders any JSON value as a short, readable cell string. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
