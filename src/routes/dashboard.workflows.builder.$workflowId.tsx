import { createFileRoute } from "@tanstack/react-router";
import { WorkflowBuilder } from "@/components/workflows/workflow-builder";

export const Route = createFileRoute("/dashboard/workflows/builder/$workflowId")({
  head: () => ({
    meta: [
      { title: "Edit Workflow — Synkra Client Portal" },
      { name: "description", content: "Edit an existing Synkra automation workflow." },
      { property: "og:title", content: "Edit Workflow — Synkra Client Portal" },
      { property: "og:description", content: "Edit an existing Synkra automation workflow." },
    ],
  }),
  component: WorkflowBuilderEdit,
});

function WorkflowBuilderEdit() {
  const { workflowId } = Route.useParams();
  return <WorkflowBuilder workflowId={workflowId} />;
}
