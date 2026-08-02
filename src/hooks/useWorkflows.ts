// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { parseJson, type WorkflowRecordShape } from "@/lib/workflow/types";
import type { WorkflowBlock } from "@/lib/workflow/types";

export interface PortalWorkflow extends WorkflowRecordShape {
  successful_runs: number;
}

function mapRecord(record: Record<string, unknown>): PortalWorkflow {
  return {
    id: record["id"] as string,
    user_id: record["user_id"] as string,
    template_id: (record["template_id"] as string) || undefined,
    name: (record["name"] as string) ?? "Untitled workflow",
    description: (record["description"] as string) ?? "",
    status: ((record["status"] as string) || "draft") as PortalWorkflow["status"],
    blocks: parseJson<WorkflowBlock[]>(record["blocks"], []),
    trigger_type: (record["trigger_type"] as string) || undefined,
    trigger_config: parseJson<Record<string, unknown>>(record["trigger_config"], {}),
    integrations_required: parseJson<string[]>(record["integrations_required"], []),
    run_count: (record["run_count"] as number) ?? 0,
    last_run_at: (record["last_run_at"] as string) || undefined,
    created: record["created"] as string,
    updated: record["updated"] as string,
    successful_runs: 0,
  };
}

export function useWorkflows() {
  const { user } = useAuth();

  return useQuery<PortalWorkflow[]>({
    queryKey: ["workflows", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const records = await pb.collection("workflows").getFullList({
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        sort: "-created",
      });
      const workflows = records.map((r) => mapRecord(r as unknown as Record<string, unknown>));

      const runs = await pb.collection("workflow_runs").getFullList({
        filter: pb.filter("user_id = {:userId} && status = 'success'", { userId: user.id }),
        fields: "workflow_id",
      });
      const successByWorkflow = new Map<string, number>();
      for (const run of runs) {
        const key = run["workflow_id"] as string;
        successByWorkflow.set(key, (successByWorkflow.get(key) ?? 0) + 1);
      }

      return workflows.map((w) => ({ ...w, successful_runs: successByWorkflow.get(w.id) ?? 0 }));
    },
    staleTime: 30000,
  });
}

export function useWorkflow(workflowId: string | undefined) {
  const { user } = useAuth();

  return useQuery<PortalWorkflow | null>({
    queryKey: ["workflow", workflowId],
    enabled: Boolean(workflowId) && Boolean(user?.id),
    queryFn: async () => {
      if (!workflowId) return null;
      const record = await pb.collection("workflows").getOne(workflowId);
      return mapRecord(record as unknown as Record<string, unknown>);
    },
    staleTime: 0,
  });
}

export async function setWorkflowStatus(workflowId: string, status: string) {
  return pb.collection("workflows").update(workflowId, { status });
}

export async function renameWorkflow(workflowId: string, name: string) {
  return pb.collection("workflows").update(workflowId, { name });
}

export async function deleteWorkflow(workflowId: string) {
  return pb.collection("workflows").delete(workflowId);
}

export async function duplicateWorkflow(workflow: PortalWorkflow) {
  return pb.collection("workflows").create({
    user_id: workflow.user_id,
    template_id: workflow.template_id ?? "",
    name: `${workflow.name} copy`,
    description: workflow.description ?? "",
    status: "draft",
    blocks: JSON.stringify(workflow.blocks),
    trigger_type: workflow.trigger_type ?? "webhook",
    trigger_config: JSON.stringify(workflow.trigger_config ?? {}),
    integrations_required: JSON.stringify(workflow.integrations_required ?? []),
    run_count: 0,
  });
}

export async function saveWorkflowDraft(params: {
  workflowId?: string;
  userId: string;
  name: string;
  blocks: WorkflowBlock[];
  templateId?: string;
  status?: string;
}) {
  const trigger = params.blocks.find((b) => b.type === "trigger");
  const payload = {
    user_id: params.userId,
    template_id: params.templateId ?? "",
    name: params.name,
    status: params.status ?? "draft",
    blocks: JSON.stringify(params.blocks),
    trigger_type: trigger?.trigger_type ?? "webhook",
    trigger_config: JSON.stringify(trigger?.config ?? {}),
  };

  if (params.workflowId) {
    return pb.collection("workflows").update(params.workflowId, payload);
  }
  return pb.collection("workflows").create({ ...payload, run_count: 0 });
}
