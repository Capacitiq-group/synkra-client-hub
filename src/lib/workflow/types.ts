export type BlockKind = "trigger" | "action" | "logic";

export interface WorkflowBlock {
  id: string;
  type: BlockKind;
  trigger_type?: string | undefined;
  action_type?: string | undefined;
  logic_type?: string | undefined;
  label: string;
  description?: string | undefined;
  config: Record<string, unknown>;
  next?: string | null | undefined;
}

export interface WorkflowRecordShape {
  id: string;
  user_id: string;
  template_id?: string | undefined;
  name: string;
  description?: string | undefined;
  status: "draft" | "published" | "paused" | "error";
  blocks: WorkflowBlock[];
  trigger_type?: string | undefined;
  trigger_config?: Record<string, unknown> | undefined;
  integrations_required?: string[] | undefined;
  run_count?: number | undefined;
  last_run_at?: string | undefined;
  created?: string | undefined;
  updated?: string | undefined;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}
