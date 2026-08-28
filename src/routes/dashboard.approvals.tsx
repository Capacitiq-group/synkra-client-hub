import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsInbox } from "@/components/approvals/approvals-inbox";

export const Route = createFileRoute("/dashboard/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — Synkra Client Portal" },
      {
        name: "description",
        content: "Review and approve AI-drafted messages and changes before they go out.",
      },
      { property: "og:title", content: "Approvals — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Review and approve AI-drafted messages and changes before they go out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsInbox,
});
