import { createFileRoute, redirect } from "@tanstack/react-router";

/** /sign-up mirrors /signup: both send visitors straight into /checkout. */
export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up — Synkra" },
      {
        name: "description",
        content: "Create your Synkra account and activate your workspace in minutes.",
      },
      { property: "og:title", content: "Sign up — Synkra" },
      {
        property: "og:description",
        content: "Create your Synkra account and activate your workspace in minutes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/checkout" });
  },
});
