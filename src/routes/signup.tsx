import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

/** Public registration is closed during pre-launch. */
export const APPLY_URL = "https://www.synkra.co.za/apply";

/**
 * Synkra is in pre-launch: there is no public registration. Anyone who lands
 * on /sign-up (or the legacy /signup path) is sent to the public application
 * and referral entry point instead. The redirect happens in beforeLoad so it
 * runs on the server and on the client before any form can render.
 */
export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Apply for Synkra early access" },
      {
        name: "description",
        content:
          "Synkra is in pre-launch. Apply for early access or refer a business at synkra.co.za/apply.",
      },
      { property: "og:title", content: "Apply for Synkra early access" },
      {
        property: "og:description",
        content:
          "Synkra is in pre-launch. Apply for early access or refer a business at synkra.co.za/apply.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ href: APPLY_URL, reloadDocument: true });
  },
  component: SignUpRedirect,
});

function SignUpRedirect() {
  // Defensive fallback: if the route ever renders (e.g. a client navigation
  // that skipped the redirect), leave immediately. No form is ever shown.
  useEffect(() => {
    window.location.replace(APPLY_URL);
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6 text-center text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      Redirecting you to the Synkra application page…
    </div>
  );
}
