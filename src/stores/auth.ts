// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { create } from "zustand";
import type { RecordModel } from "pocketbase";
import pb from "@/lib/pocketbase";
import { destroySession } from "@/lib/session";

export interface PortalUser extends RecordModel {
  email: string;
  name?: string;
  user_type?: "beta" | "paid";
  is_tester?: boolean;
}

interface AuthState {
  user: PortalUser | null;
  isReady: boolean;
  hydrate: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isReady: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    set({ user: (pb.authStore.record as PortalUser | null) ?? null, isReady: true });
    pb.authStore.onChange(() => {
      set({ user: (pb.authStore.record as PortalUser | null) ?? null });
    });
  },
  logout: () => {
    pb.authStore.clear();
    destroySession();
    set({ user: null });
  },
}));
