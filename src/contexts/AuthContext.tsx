import React, { createContext, useContext, useEffect, useState } from "react";
import pb from "@/lib/pocketbase";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection("users").authRefresh();
      setUser(getCurrentUser());
    } catch {
      pb.authStore.clear();
      setUser(null);
    }
  };

  useEffect(() => {
    setUser(getCurrentUser());
    setIsLoading(false);
    const unsubscribe = pb.authStore.onChange(() => setUser(getCurrentUser()));
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
