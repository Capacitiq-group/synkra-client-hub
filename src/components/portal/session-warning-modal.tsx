import { useNavigate } from "@tanstack/react-router";
import { destroySession, resetActivity } from "@/lib/session";
import { useAuthStore } from "@/stores/auth";

export function SessionWarningModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
    >
      <div
        className="w-full max-w-sm rounded-lg border p-6"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-default)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h2 id="session-warning-title" className="text-lg font-semibold">
          Your session is expiring
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          You will be signed out in 2 minutes due to inactivity.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              resetActivity();
              onClose();
            }}
            className="h-10 flex-1 rounded-sm text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--accent-green)",
              color: "var(--accent-green-foreground)",
            }}
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => {
              destroySession();
              logout();
              onClose();
              navigate({ to: "/login" });
            }}
            className="h-10 flex-1 rounded-sm border text-sm transition-colors"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
