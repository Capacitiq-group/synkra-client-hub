// src/lib/setupCollections.ts
// This file creates all required PocketBase collections.
// Run manually from the browser console or via a setup endpoint.
// NEVER run in production without admin credentials.
//
// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import pb from "./pocketbase";

export const COLLECTION_SCHEMAS = [
  {
    name: "users",
    type: "auth",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "business_name", type: "text" },
      { name: "business_industry", type: "text" },
      { name: "business_address", type: "text" },
      { name: "whatsapp_number", type: "text" },
      { name: "review_link", type: "text" },
      { name: "is_tester", type: "bool", options: { default: false } },
      { name: "google_calendar_link", type: "text" },
      { name: "google_sheet_id", type: "text" },
      { name: "user_type", type: "select", options: { values: ["beta", "paid"] } },
      { name: "trial_ends_at", type: "date" },
      {
        name: "theme_preference",
        type: "select",
        options: { values: ["dark", "light", "system"] },
      },
      { name: "notify_on_failure", type: "bool", options: { default: true } },
      { name: "notify_weekly_summary", type: "bool", options: { default: true } },
      { name: "notify_on_success", type: "bool", options: { default: false } },
      { name: "notify_credit_low", type: "bool", options: { default: true } },
      { name: "notify_platform_updates", type: "bool", options: { default: false } },
      { name: "notification_email", type: "email" },
      // Credits for beta users
      { name: "credit_emails", type: "number", options: { default: 100 } },
      { name: "credit_emails_used", type: "number", options: { default: 0 } },
      { name: "credit_workflows", type: "number", options: { default: 2000 } },
      { name: "credit_workflows_used", type: "number", options: { default: 0 } },
    ],
  },
  {
    name: "workflow_templates",
    type: "base",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "description", type: "text" },
      { name: "category", type: "text" },
      { name: "requires_paid_api", type: "bool" },
      { name: "integrations_required", type: "json" },
      { name: "blocks", type: "json", required: true },
      { name: "is_active", type: "bool", options: { default: true } },
      { name: "sort_order", type: "number", options: { default: 0 } },
    ],
  },
  {
    name: "workflows",
    type: "base",
    schema: [
      { name: "user_id", type: "relation", required: true, options: { collectionId: "users" } },
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
      { name: "run_count", type: "number", options: { default: 0 } },
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
      { name: "workflow_id", type: "relation", required: true, options: { collectionId: "workflows" } },
      { name: "user_id", type: "relation", required: true, options: { collectionId: "users" } },
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
      { name: "user_id", type: "relation", required: true, options: { collectionId: "users" } },
      {
        name: "type",
        type: "select",
        required: true,
        options: {
          values: ["whatsapp", "google_calendar", "google_sheets", "twilio_sms", "resend_email"],
        },
      },
      { name: "status", type: "select", options: { values: ["connected", "disconnected", "error"] } },
      { name: "display_name", type: "text" },
      { name: "last_tested_at", type: "date" },
      { name: "error_message", type: "text" },
    ],
  },
] as const;

/**
 * Creates any missing collections. Requires an authenticated PocketBase
 * superuser session — credentials are NEVER stored in this frontend.
 * Usage (browser console, one-off):
 *   const { setupCollections } = await import('/src/lib/setupCollections.ts')
 *   await setupCollections(adminEmail, adminPassword)
 */
export async function setupCollections(adminEmail: string, adminPassword: string) {
  await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);

  const existing = await pb.collections.getFullList();
  const existingNames = new Set(existing.map((c) => c.name));
  const created: string[] = [];

  for (const definition of COLLECTION_SCHEMAS) {
    if (existingNames.has(definition.name)) continue;
    await pb.collections.create({
      name: definition.name,
      type: definition.type,
      fields: definition.schema,
    });
    created.push(definition.name);
  }

  return created;
}
