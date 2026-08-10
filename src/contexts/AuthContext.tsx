import React, { useCallback, useEffect } from "react";
import pb from "@/lib/pocketbase";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

/**
 * The portal keeps its single source of auth truth in the zustand store
 * (hydrated from the persisted PocketBase auth store in the root route).
 * `useAuth` reads from that store directly, so it works everywhere without a
 * provider having to be mounted — previously this hook fell back to an empty
 * default context, which silently disabled every `enabled: Boolean(user?.id)`
 * query (templates, stats, activity) and rendered them as "no data".
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!useAuthStore.getState().isReady) useAuthStore.getState().hydrate();
  }, []);
  return <>{children}</>;
}

export function useAuth(): AuthContextType {
  const storeUser = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection("users").authRefresh();
    } catch {
      pb.authStore.clear();
    }
  }, []);

  return {
    user: (storeUser as unknown as AuthUser | null) ?? (isReady ? getCurrentUser() : null),
    isLoading: !isReady,
    refreshUser,
  };
}
