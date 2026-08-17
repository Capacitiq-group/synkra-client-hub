/**
 * Billing collection provisioning — SERVER ONLY.
 *
 * The billing pipeline creates its own PocketBase collections on first use so
 * a deployment never silently fails with "missing collection". Creation is
 * idempotent: existing collections are left untouched, missing fields are
 * added. All collections are locked down (no public API rules) — only the
 * superuser client in `@/lib/usage/pocketbase.server` may read or write them.
 *
 * See POCKETBASE_COLLECTIONS.md for the documented schema.
 */
import type PocketBase from "pocketbase";

type FieldDef = Record<string, unknown>;

const AUTODATE: FieldDef[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

interface CollectionDef {
  name: string;
  fields: FieldDef[];
  indexes?: string[];
}

export const BILLING_COLLECTIONS: CollectionDef[] = [
  {
    name: "billing_customers",
    fields: [
      { name: "user_id", type: "text" },
      { name: "email", type: "text", required: true },
      { name: "name", type: "text" },
      { name: "phone", type: "text" },
      { name: "provider", type: "text" },
      { name: "provider_customer_code", type: "text" },
      { name: "source", type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_billing_customers_user ON billing_customers (user_id)",
      "CREATE INDEX idx_billing_customers_email ON billing_customers (email)",
    ],
  },
  {
    name: "billing_checkouts",
    fields: [
      { name: "checkout_ref", type: "text", required: true },
      { name: "user_id", type: "text" },
      { name: "plan", type: "text", required: true },
      { name: "amount_zar", type: "number" },
      { name: "amount_minor", type: "number" },
      { name: "currency", type: "text" },
      { name: "provider", type: "text" },
      { name: "provider_reference", type: "text" },
      {
        name: "status",
        type: "select",
        options: { values: ["pending", "completed", "failed", "cancelled", "expired"] },
      },
      { name: "source", type: "text" },
      { name: "customer_email", type: "text" },
      { name: "customer_name", type: "text" },
      { name: "customer_phone", type: "text" },
      { name: "metadata", type: "json" },
      { name: "onboarding_email_sent", type: "bool" },
      { name: "failure_reason", type: "text" },
      { name: "completed_at", type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_billing_checkouts_ref ON billing_checkouts (checkout_ref)",
      "CREATE INDEX idx_billing_checkouts_provider_ref ON billing_checkouts (provider_reference)",
      "CREATE INDEX idx_billing_checkouts_user ON billing_checkouts (user_id)",
    ],
  },
  {
    name: "billing_payments",
    fields: [
      { name: "user_id", type: "text" },
      { name: "checkout_id", type: "text" },
      { name: "checkout_ref", type: "text" },
      { name: "plan", type: "text" },
      { name: "provider", type: "text" },
      { name: "provider_reference", type: "text", required: true },
      { name: "provider_transaction_id", type: "text" },
      { name: "amount_minor", type: "number" },
      { name: "amount_zar", type: "number" },
      { name: "currency", type: "text" },
      {
        name: "status",
        type: "select",
        options: { values: ["pending", "success", "failed", "refunded", "reversed"] },
      },
      { name: "verified", type: "bool" },
      { name: "requires_review", type: "bool" },
      { name: "verification_note", type: "text" },
      { name: "channel", type: "text" },
      { name: "paid_at", type: "date" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_billing_payments_ref ON billing_payments (provider_reference)",
      "CREATE INDEX idx_billing_payments_user ON billing_payments (user_id)",
    ],
  },
  {
    name: "billing_subscriptions",
    fields: [
      { name: "user_id", type: "text", required: true },
      { name: "plan", type: "text", required: true },
      { name: "provider", type: "text" },
      { name: "provider_reference", type: "text" },
      {
        name: "status",
        type: "select",
        options: { values: ["pending", "active", "cancelled", "expired", "past_due"] },
      },
      { name: "interval", type: "text" },
      { name: "current_period_start", type: "date" },
      { name: "current_period_end", type: "date" },
      { name: "cancel_at_period_end", type: "bool" },
      { name: "cancelled_at", type: "date" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_billing_subscriptions_user ON billing_subscriptions (user_id)"],
  },
  {
    name: "billing_events",
    fields: [
      { name: "provider", type: "text" },
      { name: "event_key", type: "text", required: true },
      { name: "event_type", type: "text" },
      { name: "reference", type: "text" },
      {
        name: "status",
        type: "select",
        options: { values: ["processing", "processed", "ignored", "failed"] },
      },
      { name: "note", type: "text" },
      { name: "payload", type: "json" },
      { name: "processed_at", type: "date" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_billing_events_key ON billing_events (event_key)"],
  },
  {
    name: "magic_links",
    fields: [
      { name: "user_id", type: "text", required: true },
      { name: "email", type: "text" },
      { name: "token_hash", type: "text", required: true },
      { name: "purpose", type: "text" },
      { name: "checkout_ref", type: "text" },
      { name: "expires_at", type: "date" },
      { name: "used_at", type: "date" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_magic_links_hash ON magic_links (token_hash)"],
  },
];

let ensured = false;

function fieldsOf(collection: unknown): FieldDef[] {
  const record = collection as { fields?: FieldDef[]; schema?: FieldDef[] };
  return record.fields ?? record.schema ?? [];
}

/** Creates any missing billing collection / field. Safe to call repeatedly. */
export async function ensureBillingCollections(pb: PocketBase, force = false): Promise<void> {
  if (ensured && !force) return;
  const existing = (await pb.collections.getFullList()) as unknown as Array<{
    id: string;
    name: string;
  }>;
  const byName = new Map(existing.map((c) => [c.name, c]));

  for (const def of BILLING_COLLECTIONS) {
    const current = byName.get(def.name);
    const fields = [...def.fields, ...AUTODATE];
    if (!current) {
      await pb.collections.create({
        name: def.name,
        type: "base",
        fields,
        schema: fields,
        ...(def.indexes ? { indexes: def.indexes } : {}),
        // No API rules: superuser access only. The browser can never read or
        // write billing state directly.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      });
      continue;
    }
    const full = (await pb.collections.getOne(current.id)) as unknown as Record<string, unknown>;
    const currentFields = fieldsOf(full);
    const names = new Set(currentFields.map((f) => f["name"] as string));
    const missing = def.fields.filter((f) => !names.has(f["name"] as string));
    if (missing.length > 0) {
      const updated = [...currentFields, ...missing];
      await pb.collections.update(current.id, { fields: updated, schema: updated });
    }
  }
  ensured = true;
}
