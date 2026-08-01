// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { create } from "zustand";
import type { RecordModel } from "pocketbase";
import pb from "@/lib/pocketbase";
import { checkRateLimit, clearRateLimit } from "@/lib/rateLimit";
import { sanitizeEmail } from "@/lib/sanitize";
import { destroySession } from "@/lib/session";

export interface PortalUser extends RecordModel {
  email: string;
  name?: string;
  user_type?: "beta" | "paid";
}

interface AuthState {
  user: PortalUser | null;
  isReady: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
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
  login: async (email, password) => {
    const cleanEmail = sanitizeEmail(email);
    const limitKey = `login:${cleanEmail}`;
    const { allowed, remainingMs } = checkRateLimit(limitKey, 5, 5 * 60 * 1000);
    if (!allowed) {
      throw new Error(
        `Too many attempts. Try again in ${Math.ceil(remainingMs / 1000 / 60)} minute(s).`,
      );
    }
    await pb.collection("users").authWithPassword(cleanEmail, password);
    clearRateLimit(limitKey);
    set({ user: (pb.authStore.record as PortalUser | null) ?? null });
  },
  logout: () => {
    pb.authStore.clear();
    destroySession();
    set({ user: null });
  },
}));
