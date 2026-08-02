export type BlockKind = "trigger" | "action" | "logic";

export interface WorkflowBlock {
  id: string;
  type: BlockKind;
  trigger_type?: string;
  action_type?: string;
  logic_type?: string;
  label: string;
  description?: string;
  config: Record<string, unknown>;
  next?: string | null;
}

export interface WorkflowRecordShape {
  id: string;
  user_id: string;
  template_id?: string;
  name: string;
  description?: string;
  status: "draft" | "published" | "paused" | "error";
  blocks: WorkflowBlock[];
  trigger_type?: string;
  trigger_config?: Record<string, unknown>;
  integrations_required?: string[];
  run_count?: number;
  last_run_at?: string;
  created?: string;
  updated?: string;
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
