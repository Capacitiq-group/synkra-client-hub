import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // TEMPORARY DIAGNOSTIC OVERLAY — remove once the blank/stuck-loading
  // issue is confirmed fixed. Surfaces otherwise-invisible client errors
  // directly on screen since devtools aren't available on mobile.
  const [caughtError, setCaughtError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      setCaughtError(`${event.message}\n${event.error?.stack ?? ""}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? `${reason.message}\n${reason.stack ?? ""}` : String(reason);
      setCaughtError(message);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    try {
      useAuthStore.getState().hydrate();
    } catch (err) {
      setCaughtError(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
    }

    // Theme initialization
    try {
      const theme = localStorage.getItem("synkra-theme");
      if (theme === "dark" || theme === "light") {
        document.documentElement.setAttribute("data-theme", theme);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
      }
    } catch (err) {
      setCaughtError(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <>
      {caughtError && (
        <pre
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "#450a0a",
            color: "#fecaca",
            fontSize: "11px",
            padding: "12px",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "50vh",
            overflow: "auto",
          }}
        >
          {caughtError}
        </pre>
      )}
      <Outlet />
    </>
  );
}
