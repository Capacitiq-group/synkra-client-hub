// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import PocketBase from "pocketbase";
import { seedTemplates } from "./seedTemplates";

export interface SetupProgress {
  onStep: (message: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

type FieldDef = Record<string, unknown>;

interface CollectionDef {
  name: string;
  type: string;
  schema: FieldDef[];
}

const COLLECTIONS: CollectionDef[] = [
  {
    name: "workflow_templates",
    type: "base",
    schema: [
      { name: "template_id", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "category", type: "text" },
      { name: "requires_paid_api", type: "bool" },
      { name: "integrations_required", type: "json" },
      { name: "blocks", type: "json", required: true },
      { name: "is_active", type: "bool" },
      { name: "sort_order", type: "number" },
    ],
  },
  {
    name: "workflows",
    type: "base",
    schema: [
      { name: "user_id", type: "text", required: true },
      { name: "template_id", type: "text" },
      { name: "name", type: "text", required: true },
      { name: "description", type: "text" },
      {
        name: "status",
        type: "select",
        required: true,
        options: { values: ["draft", "published", "paused", "error"] },
      },
      { name: "blocks", type: "json", required: true },
      { name: "trigger_type", type: "text" },
      { name: "trigger_config", type: "json" },
      { name: "integrations_required", type: "json" },
      { name: "run_count", type: "number" },
      { name: "last_run_at", type: "date" },
      {
        name: "last_run_status",
        type: "select",
        options: { values: ["success", "failed", "running"] },
      },
    ],
  },
  {
    name: "workflow_runs",
    type: "base",
    schema: [
      { name: "workflow_id", type: "text", required: true },
      { name: "user_id", type: "text", required: true },
      {
        name: "status",
        type: "select",
        required: true,
        options: { values: ["running", "success", "failed"] },
      },
      { name: "triggered_at", type: "date" },
      { name: "completed_at", type: "date" },
      { name: "duration_ms", type: "number" },
      { name: "input_data", type: "json" },
      { name: "output_data", type: "json" },
      { name: "step_logs", type: "json" },
      { name: "error_message", type: "text" },
    ],
  },
  {
    name: "integrations",
    type: "base",
    schema: [
      { name: "user_id", type: "text", required: true },
      {
        name: "type",
        type: "select",
        required: true,
        options: {
          values: [
            "whatsapp",
            "google_calendar",
            "google_sheets",
            "twilio_sms",
            "resend_email",
          ],
        },
      },
      {
        name: "status",
        type: "select",
        options: { values: ["connected", "disconnected", "error"] },
      },
      { name: "display_name", type: "text" },
      { name: "last_tested_at", type: "date" },
      { name: "error_message", type: "text" },
    ],
  },
];

const USER_FIELDS: FieldDef[] = [
  { name: "business_name", type: "text" },
  { name: "business_industry", type: "text" },
  { name: "business_address", type: "text" },
  { name: "whatsapp_number", type: "text" },
  { name: "user_type", type: "select", options: { values: ["beta", "paid"] } },
  { name: "trial_ends_at", type: "date" },
  {
    name: "theme_preference",
    type: "select",
    options: { values: ["dark", "light", "system"] },
  },
  { name: "notify_on_failure", type: "bool" },
  { name: "notify_weekly_summary", type: "bool" },
  { name: "notification_email", type: "email" },
  { name: "credit_emails", type: "number" },
  { name: "credit_emails_used", type: "number" },
  { name: "credit_workflows", type: "number" },
  { name: "credit_workflows_used", type: "number" },
  { name: "onboarding_completed", type: "bool" },
  { name: "onboarding_step", type: "number" },
];

/** PocketBase 0.23 renamed the admins collection to _superusers. Support both. */
async function authenticateAdmin(pb: PocketBase, email: string, password: string) {
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch (err) {
    const legacy = (pb as unknown as { admins?: { authWithPassword: (e: string, p: string) => Promise<unknown> } })
      .admins;
    if (!legacy) throw err;
    await legacy.authWithPassword(email, password);
  }
}

function fieldsOf(collection: unknown): FieldDef[] {
  const c = collection as { fields?: FieldDef[]; schema?: FieldDef[] };
  return c.fields ?? c.schema ?? [];
}

export async function runFirstTimeSetup(
  pbUrl: string,
  adminEmail: string,
  adminPassword: string,
  progress: SetupProgress,
): Promise<void> {
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);

  try {
    progress.onStep("Signing in to PocketBase");
    await authenticateAdmin(pb, adminEmail, adminPassword);

    const existingCollections = await pb.collections.getFullList();
    const existingNames = new Set(existingCollections.map((c) => c.name));

    progress.onStep("Creating collections");
    for (const collection of COLLECTIONS) {
      if (existingNames.has(collection.name)) continue;
      const fields = collection.schema.map(normalizeField);
      await pb.collections.create({
        name: collection.name,
        type: collection.type,
        fields,
        schema: fields,
      });
    }


    progress.onStep("Extending the users collection");
    const usersCollection = existingCollections.find((c) => c.name === "users");
    if (usersCollection) {
      const current = fieldsOf(usersCollection);
      const existingFieldNames = new Set(current.map((f) => f["name"] as string));
      const newFields = USER_FIELDS.filter((f) => !existingFieldNames.has(f["name"] as string));
      if (newFields.length > 0) {
        const updated = [...current, ...newFields];
        await pb.collections.update(usersCollection.id, {
          fields: updated,
          schema: updated,
        });
      }
    }

    progress.onStep("Seeding workflow templates");
    await seedTemplates(pb);

    progress.onStep("Setup complete");
    progress.onComplete();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed.";
    progress.onError(message);
  } finally {
    pb.authStore.clear();
  }
}
