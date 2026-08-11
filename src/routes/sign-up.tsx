import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { APPLY_URL } from "./signup";

/** /sign-up mirrors /signup: both send prospective users to the apply page. */
export const Route = createFileRoute("/sign-up")({
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
  component: SignUpAliasRedirect,
});

function SignUpAliasRedirect() {
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
