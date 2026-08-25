// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * First-time / idempotent PocketBase provisioning.
 *
 * The schema itself is NOT defined here. It lives in the canonical
 * `pb_schema.json` at the repository root, which is also read by
 * `scripts/seed-pocketbase.mjs` and documented in POCKETBASE_COLLECTIONS.md,
 * so setup, deploy seeding and documentation can never drift apart.
 */
import PocketBase from "pocketbase";
import { seedTemplates } from "./seedTemplates";
import rawSchema from "../../../pb_schema.json?raw";

export interface SetupProgress {
  onStep: (message: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export type FieldDef = Record<string, unknown>;

export interface CollectionRules {
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
}

export interface CollectionDef {
  name: string;
  type: string;
  /** true = superuser-only collection: every API rule stays null. */
  serverOnly?: boolean;
  /**
   * API rules the collection needs to work from the browser. Applied on
   * creation, and to an existing collection only when every live rule is still
   * null — a rule an operator set by hand is never overwritten.
   */
  rules?: CollectionRules;
  fields: FieldDef[];
  indexes?: string[];
}


interface SchemaFile {
  collections: CollectionDef[];
  userFields: FieldDef[];
}

const SCHEMA = JSON.parse(rawSchema) as SchemaFile;

export const COLLECTIONS: CollectionDef[] = SCHEMA.collections;
export const USER_FIELDS: FieldDef[] = SCHEMA.userFields;

/** Collections created through the API do not get created/updated unless asked. */
const AUTODATE_FIELDS: FieldDef[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
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
export function normalizeField(field: FieldDef): FieldDef {
  const { options, ...rest } = field as FieldDef & { options?: Record<string, unknown> };
  const base = options ? { ...rest, ...options } : rest;
  if (base["type"] === "select") {
    return { maxSelect: 1, ...base };
  }
  return base;
}

function indexName(sql: string): string {
  const match = /INDEX\s+`?([A-Za-z0-9_]+)`?/i.exec(sql);
  return match?.[1] ?? sql;
}

/** Adds any index in the schema file that the live collection does not have. */
async function syncIndexes(pb: PocketBase, collectionName: string, wanted: string[] | undefined) {
  if (!wanted || wanted.length === 0) return;
  const live = await pb.collections.getFirstListItem(
    pb.filter("name = {:name}", { name: collectionName }),
  );
  const current = ((live as unknown as { indexes?: string[] }).indexes ?? []).slice();
  const currentNames = new Set(current.map(indexName));
  const missing = wanted.filter((sql) => !currentNames.has(indexName(sql)));
  if (missing.length === 0) return;
  await pb.collections.update(live.id, { indexes: [...current, ...missing] });
}

const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"] as const;

/** Rules for a brand-new collection. */
export function rulesForCreate(collection: CollectionDef): Record<string, string | null> {
  if (collection.serverOnly) {
    // Superuser-only: the browser can never read or write these.
    return Object.fromEntries(RULE_KEYS.map((key) => [key, null]));
  }
  if (!collection.rules) return {};
  return Object.fromEntries(
    RULE_KEYS.map((key) => [key, collection.rules?.[key] ?? null]),
  ) as Record<string, string | null>;
}

/**
 * Applies the schema's API rules to an existing collection, but only when every
 * live rule is still null. This makes an already-provisioned instance pick up a
 * newly added collection's rules without ever discarding rules an operator
 * tuned by hand.
 */
async function syncRules(pb: PocketBase, live: { id: string }, collection: CollectionDef) {
  if (collection.serverOnly || !collection.rules) return;
  const record = live as unknown as Record<string, unknown>;
  const allNull = RULE_KEYS.every((key) => record[key] === null || record[key] === undefined);
  if (!allNull) return;
  await pb.collections.update(live.id, rulesForCreate(collection));
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
      const fields = [...collection.fields.map(normalizeField), ...AUTODATE_FIELDS];
      await pb.collections.create({
        name: collection.name,
        type: collection.type,
        fields,
        schema: fields,
        ...rulesForCreate(collection),
      });
    }


    progress.onStep("Adding any missing fields to existing collections");
    const afterCreate = await pb.collections.getFullList();
    for (const collection of COLLECTIONS) {
      const existing = afterCreate.find((c) => c.name === collection.name);
      if (!existing) continue;
      const current = fieldsOf(existing);
      const names = new Set(current.map((f) => f["name"] as string));
      const missing = [...collection.fields.map(normalizeField), ...AUTODATE_FIELDS].filter(
        (f) => !names.has(f["name"] as string),
      );
      if (missing.length === 0) continue;
      const updated = [...current, ...missing];
      await pb.collections.update(existing.id, { fields: updated, schema: updated });
    }

    progress.onStep("Applying indexes");
    for (const collection of COLLECTIONS) {
      await syncIndexes(pb, collection.name, collection.indexes);
    }

    progress.onStep("Applying API rules");
    for (const collection of COLLECTIONS) {
      const live = afterCreate.find((c) => c.name === collection.name);
      if (live) await syncRules(pb, live, collection);
    }


    progress.onStep("Extending the users collection");
    const usersCollection = afterCreate.find((c) => c.name === "users");
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
