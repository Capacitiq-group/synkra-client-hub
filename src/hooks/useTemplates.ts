// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { useQuery } from "@tanstack/react-query";
import pb, { getFullListSafe } from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";

export interface TemplateBlock {
  id: string;
  type: string;
  trigger_type?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PortalTemplate {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category: string;
  blocks: TemplateBlock[];
  integrations_required: string[];
  requires_paid_api?: boolean;
  isActivated: boolean;
  workflowId: string | null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

export function useTemplates() {
  const { user } = useAuth();

  return useQuery<PortalTemplate[]>({
    queryKey: ["templates", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const templates = await getFullListSafe<Record<string, unknown> & { id: string }>("workflow_templates", {
        filter: "is_active = true",
        sort: "sort_order",
      });

      const userWorkflows = await getFullListSafe<Record<string, unknown> & { id: string }>("workflows", {
        filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        fields: "id,template_id",
      });

      const activated = new Map<string, string>();
      for (const w of userWorkflows) {
        const templateId = w["template_id"] as string | undefined;
        if (templateId && !activated.has(templateId)) activated.set(templateId, w.id);
      }

      return templates.map((t) => ({
        id: t.id,
        template_id: t["template_id"] as string,
        name: t["name"] as string,
        description: (t["description"] as string) ?? "",
        category: (t["category"] as string) ?? "",
        requires_paid_api: Boolean(t["requires_paid_api"]),
        blocks: parseJson<TemplateBlock[]>(t["blocks"], []),
        integrations_required: parseJson<string[]>(t["integrations_required"], []),
        isActivated: activated.has(t["template_id"] as string),
        workflowId: activated.get(t["template_id"] as string) ?? null,
      }));
    },
    staleTime: 60000,
  });
}

export async function activateTemplate(template: PortalTemplate, userId: string) {
  const firstBlock = template.blocks[0];
  return pb.collection("workflows").create({
    user_id: userId,
    template_id: template.template_id,
    name: template.name,
    description: template.description,
    status: "draft",
    blocks: JSON.stringify(template.blocks),
    trigger_type: firstBlock?.trigger_type || "webhook",
    trigger_config: JSON.stringify(firstBlock?.config || {}),
    integrations_required: JSON.stringify(template.integrations_required),
    run_count: 0,
  });
}
