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
  /** Raw SQLite index statements applied after the collection exists. */
  indexes?: string[];
}

/** Collections created through the API do not get created/updated unless asked. */
const AUTODATE_FIELDS: FieldDef[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

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
        options: { values: ["running", "success", "failed", "blocked"] },
      },
      // Execution accounting. execution_id identifies ONE workflow run; retries
      // reuse it so they never count twice. counted records whether this run
      // consumed one of the account's monthly executions.
      { name: "execution_id", type: "text" },
      { name: "trigger_type", type: "text" },
      { name: "attempt_count", type: "number" },
      { name: "counted", type: "bool" },
      { name: "blocked_reason", type: "text" },
      { name: "triggered_at", type: "date" },
      { name: "completed_at", type: "date" },
      { name: "duration_ms", type: "number" },
      { name: "input_data", type: "json" },
      { name: "output_data", type: "json" },
      { name: "step_logs", type: "json" },
      { name: "error_message", type: "text" },
    ],
    // execution_id identifies ONE run. A partial unique index keeps retries
    // from creating a second row while still allowing legacy/blank values
    // (SQLite treats '' as a real value, so it must be excluded explicitly).
    indexes: [
      "CREATE UNIQUE INDEX `idx_unique_workflow_runs_execution_id` ON `workflow_runs` (`execution_id`) WHERE `execution_id` != ''",
      "CREATE INDEX `idx_workflow_runs_user_id` ON `workflow_runs` (`user_id`)",
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
          values: ["whatsapp", "google_calendar", "google_sheets", "twilio_sms", "resend_email"],
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
  {
    // One workspace per plan on every current tier. Separate from seats.
    name: "workspaces",
    type: "base",
    schema: [
      { name: "owner_id", type: "text", required: true },
      { name: "name", type: "text", required: true },
      { name: "is_default", type: "bool" },
    ],
    indexes: ["CREATE INDEX `idx_workspaces_owner_id` ON `workspaces` (`owner_id`)"],
  },
  {
    // Seats. Field names match src/lib/team/team.server.ts exactly.
    name: "workspace_members",
    type: "base",
    schema: [
      { name: "workspace_id", type: "text", required: true },
      { name: "user_id", type: "text", required: true },
      { name: "email", type: "text" },
      { name: "name", type: "text" },
      {
        name: "role",
        type: "select",
        required: true,
        options: { values: ["owner", "admin", "member"] },
      },
      // "removed" keeps the row for history while releasing the seat.
      {
        name: "status",
        type: "select",
        required: true,
        options: { values: ["active", "removed"] },
      },
      { name: "invited_by", type: "text" },
      { name: "joined_at", type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_unique_workspace_members` ON `workspace_members` (`workspace_id`, `user_id`)",
    ],
  },
  {
    // Pending invitations reserve a seat until accepted/cancelled/expired.
    name: "workspace_invitations",
    type: "base",
    schema: [
      { name: "workspace_id", type: "text", required: true },
      { name: "email", type: "text", required: true },
      {
        name: "role",
        type: "select",
        required: true,
        options: { values: ["admin", "member"] },
      },
      {
        name: "status",
        type: "select",
        required: true,
        options: { values: ["pending", "accepted", "cancelled", "expired"] },
      },
      { name: "token", type: "text", required: true },
      { name: "invited_by", type: "text" },
      { name: "expires_at", type: "date" },
      { name: "accepted_at", type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_unique_workspace_invitations_token` ON `workspace_invitations` (`token`)",
      "CREATE INDEX `idx_workspace_invitations_workspace_id` ON `workspace_invitations` (`workspace_id`)",
    ],
  },
];

const USER_FIELDS: FieldDef[] = [
  { name: "business_name", type: "text" },
  { name: "business_industry", type: "text" },
  { name: "business_address", type: "text" },
  { name: "whatsapp_number", type: "text" },
  { name: "review_link", type: "text" },
  { name: "is_tester", type: "bool" },
  { name: "user_type", type: "select", options: { values: ["beta", "paid"] } },
  { name: "trial_ends_at", type: "date" },
  {
    name: "theme_preference",
    type: "select",
    options: { values: ["dark", "light", "system"] },
  },
  { name: "notify_on_failure", type: "bool" },
  { name: "notify_weekly_summary", type: "bool" },
  { name: "notify_on_success", type: "bool" },
  { name: "notify_credit_low", type: "bool" },
  { name: "notify_platform_updates", type: "bool" },
  { name: "notification_email", type: "email" },
  { name: "credit_emails", type: "number" },
  { name: "credit_emails_used", type: "number" },
  { name: "credit_workflows", type: "number" },
  { name: "credit_workflows_used", type: "number" },
  { name: "onboarding_completed", type: "bool" },
  { name: "onboarding_step", type: "number" },
  // Plan + usage accounting (server-owned; never written by the browser).
  { name: "tier", type: "select", options: { values: ["free", "basic", "pro"] } },
  { name: "billing_period_start", type: "date" },
  { name: "executions_used_this_month", type: "number" },
  { name: "ai_ops_used_this_month", type: "number" },
  { name: "emails_used_this_month", type: "number" },
  { name: "storage_used_mb", type: "number" },
];

/** PocketBase 0.23 renamed the admins collection to _superusers. Support both. */
async function authenticateAdmin(pb: PocketBase, email: string, password: string) {
  try {
    await pb.collection("_superusers").authWithPassword(email, password);
  } catch (err) {
    const legacy = (
      pb as unknown as { admins?: { authWithPassword: (e: string, p: string) => Promise<unknown> } }
    ).admins;
    if (!legacy) throw err;
    await legacy.authWithPassword(email, password);
  }
}

function fieldsOf(collection: unknown): FieldDef[] {
  const c = collection as { fields?: FieldDef[]; schema?: FieldDef[] };
  return c.fields ?? c.schema ?? [];
}

/** PocketBase 0.23+ expects select values at the top level of the field definition. */
function normalizeField(field: FieldDef): FieldDef {
  const { options, ...rest } = field as FieldDef & { options?: Record<string, unknown> };
  if (!options) return rest;
  return { ...rest, ...options, maxSelect: (options["maxSelect"] as number) ?? 1 };
}

/**
 * Widens an existing select field with any values the desired schema adds
 * (e.g. workflow_runs.status gaining "blocked"). Returns the same object when
 * nothing changes so callers can skip needless updates.
 */
function mergeSelectValues(field: FieldDef, wanted: FieldDef[]): FieldDef {
  if (field["type"] !== "select") return field;
  const target = wanted.find((f) => f["name"] === field["name"]);
  if (!target) return field;
  const current = Array.isArray(field["values"]) ? (field["values"] as string[]) : [];
  const desired = Array.isArray(target["values"]) ? (target["values"] as string[]) : [];
  const missing = desired.filter((value) => !current.includes(value));
  if (missing.length === 0) return field;
  return { ...field, values: [...current, ...missing] };
}

/**
 * Applies any index this schema declares that the live collection is missing.
 * Failures are reported, not thrown: a unique index cannot be created while
 * duplicate rows exist, and that must not abort the rest of the setup.
 */
async function ensureIndexes(
  pb: PocketBase,
  collectionId: string,
  definition: CollectionDef,
  progress: SetupProgress,
) {
  if (!definition.indexes || definition.indexes.length === 0) return;
  const live = await pb.collections.getOne(collectionId);
  const current = (live as unknown as { indexes?: string[] }).indexes ?? [];
  const indexName = (sql: string) => sql.match(/INDEX\s+[`"]?([\w]+)[`"]?/i)?.[1] ?? sql;
  const existingNames = new Set(current.map(indexName));
  const missing = definition.indexes.filter((sql) => !existingNames.has(indexName(sql)));
  if (missing.length === 0) return;
  try {
    await pb.collections.update(collectionId, { indexes: [...current, ...missing] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progress.onStep(`Could not create indexes on ${definition.name}: ${message}`);
  }
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
      const fields = [...collection.schema.map(normalizeField), ...AUTODATE_FIELDS];
      await pb.collections.create({
        name: collection.name,
        type: collection.type,
        fields,
        schema: fields,
        ...(collection.indexes ? { indexes: collection.indexes } : {}),
      });
    }

    progress.onStep("Adding any missing fields to existing collections");
    for (const collection of COLLECTIONS) {
      const existing = existingCollections.find((c) => c.name === collection.name);
      if (!existing) continue;
      const wanted = [...collection.schema.map(normalizeField), ...AUTODATE_FIELDS];
      const current = fieldsOf(existing);
      const names = new Set(current.map((f) => f["name"] as string));
      const missing = wanted.filter((f) => !names.has(f["name"] as string));
      // A pre-existing select field can be missing newer values (e.g.
      // workflow_runs.status gained "blocked"), so widen it in place.
      const merged = current.map((field) => mergeSelectValues(field, wanted));
      const changed =
        missing.length > 0 || merged.some((field, i) => field !== (current[i] as FieldDef));
      if (changed) {
        const updated = [...merged, ...missing];
        await pb.collections.update(existing.id, { fields: updated, schema: updated });
      }
      await ensureIndexes(pb, existing.id, collection, progress);
    }

    progress.onStep("Extending the users collection");
    const usersCollection = existingCollections.find((c) => c.name === "users");
    if (usersCollection) {
      const current = fieldsOf(usersCollection);
      const existingFieldNames = new Set(current.map((f) => f["name"] as string));
      const newFields = USER_FIELDS.filter((f) => !existingFieldNames.has(f["name"] as string)).map(
        normalizeField,
      );
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
