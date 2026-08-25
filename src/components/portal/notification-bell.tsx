import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { notificationTarget, type AppNotification } from "@/lib/notification-feed";
import { relativeTime } from "@/lib/utils/time";

function goToNotification(
  notification: AppNotification,
  navigate: ReturnType<typeof useNavigate>,
) {
  const target = notificationTarget(notification);
  if (target.kind === "run") {
    return navigate({ to: "/dashboard/activity", search: { run: target.runId } });
  }
  if (target.kind === "workflow") {
    return navigate({
      to: "/dashboard/workflows/builder/$workflowId",
      params: { workflowId: target.workflowId },
    });
  }
  if (target.kind === "settings") {
    return navigate({
      to: "/dashboard/settings",
      search: { tab: target.tab as "profile" | "business" | "workspace" | "usage" | "billing" | "notifications" },
    });
  }
  return navigate({ to: target.path });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { count } = useUnreadNotificationCount();
  const { data, isLoading, markRead, markAllRead } = useNotifications({ perPage: 6 });

  const openNotification = (notification: AppNotification) => {
    if (!notification.read) markRead.mutate({ id: notification.id });
    setOpen(false);
    void goToNotification(notification, navigate);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
          className="relative"
        >
          <Bell aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : data?.items.length ? (
            data.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className="synkra-focus flex w-full gap-3 border-b p-4 text-left hover:bg-muted"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-border" : "bg-accent"}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{notification.title}</span>
                  {notification.message && (
                    <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                  )}
                  <span className="mt-1.5 block text-[11px] text-muted-foreground">
                    {relativeTime(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <Bell className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Updates about your workflows will appear here.</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className="h-11 w-full rounded-none"
          onClick={() => {
            setOpen(false);
            void navigate({ to: "/dashboard/notifications" });
          }}
        >
          View all notifications
        </Button>
      </PopoverContent>
    </Popover>
  );
        }
