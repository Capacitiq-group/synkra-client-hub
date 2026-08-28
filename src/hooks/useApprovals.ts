import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { safeSubscribe } from "@/lib/pocketbase";
import { fetchPendingApprovals } from "@/lib/approvals-feed";
import { approvePendingAction, rejectPendingAction } from "@/lib/workflow/api";

export function useApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["approvals", userId],
    enabled: Boolean(userId),
    queryFn: () => {
      if (!userId) throw new Error("Not authenticated");
      return fetchPendingApprovals(userId);
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!userId) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void safeSubscribe("pending_approvals", "*", (event) => {
      if (event.record["user_id"] !== userId) return;
      void queryClient.invalidateQueries({ queryKey: ["approvals", userId] });
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unsubscribe = cleanup;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, userId]);

  const approve = useMutation({
    mutationFn: (approvalId: string) => {
      if (!userId) throw new Error("Not authenticated");
      return approvePendingAction(approvalId, userId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["approvals", userId] }),
  });

  const reject = useMutation({
    mutationFn: (approvalId: string) => {
      if (!userId) throw new Error("Not authenticated");
      return rejectPendingAction(approvalId, userId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["approvals", userId] }),
  });

  return { ...query, approve, reject };
}
