import { toast } from "sonner";
import { Bell, Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApprovals } from "@/hooks/useApprovals";
import { relativeTime } from "@/lib/utils/time";
import type { PendingApprovalRow } from "@/lib/approvals-feed";

const TYPE_LABEL: Record<string, string> = {
  zoho_invoice_reminder: "Payment reminder",
  zoho_customer_checkin: "Customer check-in",
  zoho_contact_datafix: "Contact fix",
};

function ApprovalCard({
  item,
  onApprove,
  onReject,
  busy,
}: {
  item: PendingApprovalRow;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const isEmail = item.type !== "zoho_contact_datafix";
  const label = TYPE_LABEL[item.type] ?? "Draft";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <CardTitle className="mt-1 text-base">
            {isEmail ? item.subject || `To ${item.recipientName || item.recipientEmail}` : item.body}
          </CardTitle>
          {isEmail && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail size={14} aria-hidden="true" />
              {item.recipientName ? `${item.recipientName} — ` : ""}
              {item.recipientEmail}
            </p>
          )}
        </div>
        <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(item.createdAt)}
        </time>
      </CardHeader>
      {isEmail && (
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
        </CardContent>
      )}
      <CardContent className="flex justify-end gap-2 pt-0">
        <Button variant="outline" size="sm" disabled={busy} onClick={onReject}>
          <X size={14} aria-hidden="true" />
          Reject
        </Button>
        <Button size="sm" disabled={busy} onClick={onApprove}>
          <Check size={14} aria-hidden="true" />
          {isEmail ? "Approve & send" : "Approve & apply"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ApprovalsInbox() {
  const { data, isLoading, isError, refetch, approve, reject } = useApprovals();

  const handleApprove = (item: PendingApprovalRow) => {
    approve.mutate(item.id, {
      onSuccess: () =>
        toast.success(item.type === "zoho_contact_datafix" ? "Applied in Zoho Books" : "Sent"),
      onError: () => toast.error("Could not complete this action. Please try again."),
    });
  };

  const handleReject = (item: PendingApprovalRow) => {
    reject.mutate(item.id, {
      onSuccess: () => toast.success("Dismissed"),
      onError: () => toast.error("Could not dismiss this. Please try again."),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[720px] p-4 md:p-10">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-drafted messages and Zoho Books changes from your finance workflows. Nothing sends or
          changes until you approve it here.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4" aria-live="polite">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading approvals…</p>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-error">Approvals could not be loaded.</p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : data?.length ? (
          data.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              busy={approve.isPending || reject.isPending}
              onApprove={() => handleApprove(item)}
              onReject={() => handleReject(item)}
            />
          ))
        ) : (
          <div className="py-20 text-center">
            <Bell className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nothing waiting on you right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
