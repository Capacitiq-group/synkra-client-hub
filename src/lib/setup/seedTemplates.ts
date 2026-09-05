// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Pre-built workflow templates seeded into the PocketBase `workflow_templates`
 * collection, and shown in the onboarding wizard.
 *
 * Seeding is idempotent: each template is matched on `template_id` and updated
 * in place, so re-running setup never creates duplicates.
 */
import type PocketBase from "pocketbase";
import templates from "./templates.json";

export interface SeedTemplateBlock {
  id: string;
  type: "trigger" | "action" | "logic";
  trigger_type?: string;
  action_type?: string;
  logic_type?: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
  next: string | null;
}

export interface SeedTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  requires_paid_api: boolean;
  integrations_required: string[];
  is_active: boolean;
  sort_order: number;
  blocks: SeedTemplateBlock[];
}

/** The template library itself lives in ./templates.json so that both the
 *  portal (setup wizard, onboarding) and the deploy-time seed script
 *  (scripts/seed-pocketbase.mjs) read exactly the same list. */
export const TEMPLATES: SeedTemplate[] = templates as unknown as SeedTemplate[];

/** Creates or updates every template above. Safe to run repeatedly. */
export async function seedTemplates(pb: PocketBase): Promise<void> {
  for (const template of TEMPLATES) {
    const payload = {
      ...template,
      blocks: JSON.stringify(template.blocks),
      integrations_required: JSON.stringify(template.integrations_required),
    };
    let existing: { id: string } | null = null;
    try {
      existing = await pb
        .collection("workflow_templates")
        .getFirstListItem(pb.filter("template_id = {:id}", { id: template.template_id }));
    } catch {
      existing = null;
    }
    if (existing) {
      await pb.collection("workflow_templates").update(existing.id, payload);
    } else {
      await pb.collection("workflow_templates").create(payload);
    }
  }
}
