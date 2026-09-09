import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import {
  installClientErrorReporting,
  reportCaughtError,
} from "@/lib/client-error-reporting";
import { useAuthStore } from "@/stores/auth";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Synkra Client Portal" },
      { name: "description", content: "Manage your Synkra automation workflows." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon.png", type: "image/png", sizes: "512x512" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootErrorScreen,
});

/**
 * Friendly replacement for the blank screen a render/loader crash would
 * otherwise leave behind. It also reports the crash to synkra-core, so the
 * failure raises the same email and in-app alert as a backend failure.
 */
function RootErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    reportCaughtError(error, "react");
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page didn&apos;t load properly. Our team has been notified automatically. You
        can try again, or head back to your dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className="underline">
        Go home
      </Link>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Hydration-safe: the store starts with isReady=false on the server and is
  // hydrated from the persisted PocketBase auth store after mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Catch blank screens and failed page scripts across the whole portal.
    installClientErrorReporting();
    useAuthStore.getState().hydrate();

    try {
      const theme = localStorage.getItem("synkra-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute(
        "data-theme",
        theme === "dark" || theme === "light" ? theme : prefersDark ? "dark" : "light",
      );
    } catch {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  void mounted;

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {/* Single global toast outlet — every save/update/delete reports here. */}
      <Toaster position="top-center" closeButton />
    </QueryClientProvider>
  );
}
