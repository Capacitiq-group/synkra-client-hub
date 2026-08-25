import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { safeSubscribe } from "@/lib/pocketbase";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type FetchNotificationsOptions,
} from "@/lib/notification-feed";

export function useNotifications(
  options: Omit<FetchNotificationsOptions, "userId"> = {},
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const unreadOnly = options.unreadOnly ?? false;
  const eventType = options.eventType ?? "";

  const query = useQuery({
    queryKey: ["notifications", userId, page, perPage, unreadOnly, eventType],
    enabled: Boolean(userId),
    queryFn: () => {
      if (!userId) throw new Error("Not authenticated");
      return fetchNotifications({
        userId,
        page,
        perPage,
        unreadOnly,
        ...(eventType ? { eventType } : {}),
      });
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!userId) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void safeSubscribe("notifications", "*", (event) => {
      if (event.record["user_id"] !== userId) return;
      void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unsubscribe = cleanup;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, userId]);

  const markRead = useMutation({
    mutationFn: ({ id, read = true }: { id: string; read?: boolean }) =>
      markNotificationRead(id, read),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Not authenticated");
      return markAllNotificationsRead(userId);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  return { ...query, markRead, markAllRead };
}

export function useUnreadNotificationCount() {
  const result = useNotifications({ page: 1, perPage: 1, unreadOnly: true });
  return {
    count: result.data?.totalItems ?? 0,
    isLoading: result.isLoading,
    isError: result.isError,
  };
}
