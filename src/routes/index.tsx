import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Synkra Client Portal" },
      { name: "description", content: "Sign in to manage your Synkra automation workflows." },
      { property: "og:title", content: "Synkra Client Portal" },
      {
        property: "og:description",
        content: "Sign in to manage your Synkra automation workflows.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const isReady = useAuthStore((s) => s.isReady);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isReady) return;
    navigate({ to: user ? "/dashboard" : "/login", replace: true });
  }, [isReady, user, navigate]);

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      Loading…
    </div>
  );
}
