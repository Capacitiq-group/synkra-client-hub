// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Pending-approval feed — browser side.
 *
 * Rows are the `pending_approvals` collection written by
 * workflows/zoho/_shared.py's submit_for_approval() (synkra-core, using
 * its own service credentials — see that file's docstring for the
 * schema and suggested PocketBase rules). The browser only ever reads
 * its own rows here; the actual approve/reject actions
 * (approvePendingAction / rejectPendingAction in lib/workflow/api.ts)
 * go through synkra-core, since approving sends a real email and/or
 * writes to Zoho Books — never something the browser does directly.
 */
import pb, { getListSafe } from "@/lib/pocketbase";

export interface PendingApprovalRow {
  id: string;
  userId: string;
  type: string;
  status: "pending" | "approved" | "sent" | "rejected" | (string & {});
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName: string;
  createdAt: Date;
}

export const PENDING_APPROVALS_COLLECTION = "pending_approvals";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function mapPendingApproval(record: Record<string, unknown>): PendingApprovalRow {
  return {
    id: String(record["id"] ?? ""),
    userId: text(record["user_id"]),
    type: text(record["type"]),
    status: (text(record["status"]) || "pending") as PendingApprovalRow["status"],
    subject: text(record["subject"]),
    body: text(record["body"]),
    recipientEmail: text(record["recipient_email"]),
    recipientName: text(record["recipient_name"]),
    createdAt: new Date(text(record["created"]) || Date.now()),
  };
}

export async function fetchPendingApprovals(userId: string): Promise<PendingApprovalRow[]> {
  const result = await getListSafe<Record<string, unknown>>(PENDING_APPROVALS_COLLECTION, 1, 50, {
    filter: `${pb.filter("user_id = {:userId}", { userId })} && status = "pending"`,
    sort: "-created",
  });
  return result.items.map(mapPendingApproval);
}
