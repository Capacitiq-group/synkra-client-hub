import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { eventMeta } from "@/lib/notification-events";
import { notificationTarget, type AppNotification } from "@/lib/notification-feed";
import { relativeTime } from "@/lib/utils/time";

export const Route = createFileRoute("/dashboard/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Synkra Client Portal" },
      { name: "description", content: "Workflow, account, and platform notifications." },
      { property: "og:title", content: "Notifications — Synkra Client Portal" },
      { property: "og:description", content: "Workflow, account, and platform notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const severityIcon = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, isError, refetch, markRead, markAllRead } = useNotifications({
    page,
    perPage: 20,
    unreadOnly,
  });

  const openNotification = (notification: AppNotification) => {
    if (!notification.read) markRead.mutate({ id: notification.id });
    const target = notificationTarget(notification);
    if (target.kind === "run") {
      void navigate({ to: "/dashboard/activity", search: { run: target.runId } });
    } else if (target.kind === "workflow") {
      void navigate({
        to: "/dashboard/workflows/builder/$workflowId",
        params: { workflowId: target.workflowId },
      });
    } else if (target.kind === "settings") {
      void navigate({
        to: "/dashboard/settings",
        search: { tab: target.tab as "profile" | "business" | "workspace" | "usage" | "billing" | "notifications" },
      });
    } else {
      void navigate({ to: target.path });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[900px] p-4 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Workflow outcomes, usage alerts, summaries, and platform news.</p>
        </div>
        {(data?.items.some((item) => !item.read) ?? false) && (
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="mt-6 flex gap-2 border-b pb-3">
        <Button variant={unreadOnly ? "ghost" : "secondary"} size="sm" onClick={() => { setUnreadOnly(false); setPage(1); }}>All</Button>
        <Button variant={unreadOnly ? "secondary" : "ghost"} size="sm" onClick={() => { setUnreadOnly(true); setPage(1); }}>Unread</Button>
      </div>

      <div aria-live="polite">
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading notifications…</p>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-error">Notifications could not be loaded.</p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : data?.items.length ? (
          <div>
            {data.items.map((notification) => {
              const Icon = severityIcon[notification.severity];
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="synkra-focus grid w-full grid-cols-[40px_minmax(0,1fr)_auto] gap-3 border-b py-5 text-left hover:bg-muted"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md bg-${notification.severity}-bg text-${notification.severity}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{notification.title}</span>
                      {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    </span>
                    {notification.message && <span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>}
                    <span className="mt-2 block text-xs text-muted-foreground">{eventMeta(notification.eventType).label}</span>
                  </span>
                  <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={notification.createdAt.toISOString()}>
                    {relativeTime(notification.createdAt)}
                  </time>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Bell className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">{unreadOnly ? "No unread notifications" : "No notifications yet"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{unreadOnly ? "You’re all caught up." : "New workflow and account updates will appear here."}</p>
          </div>
        )}
      </div>

      {(data?.totalPages ?? 1) > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page} of {data?.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
                  }
