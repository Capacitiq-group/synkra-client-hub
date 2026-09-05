#!/usr/bin/env node
/**
 * Deploy-time PocketBase seeding.
 *
 * Guarantees, idempotently, on every deploy:
 *   1. The owner account exists in _superusers with a known password.
 *   2. The same address exists in the portal `users` collection, verified,
 *      flagged as a tester and topped up with credits, with a known password.
 *   3. The `users` collection carries every field the portal reads.
 *
 * Required env:
 *   POCKETBASE_URL          e.g. http://167.86.106.152:8093
 *   PB_ADMIN_EMAIL          existing superuser email
 *   PB_ADMIN_PASSWORD       existing superuser password
 * Optional env:
 *   SEED_OWNER_EMAIL        default rmolapisi@capacitiqgroup.co.za
 *   SEED_OWNER_PASSWORD     default from SEED_OWNER_PASSWORD, required in prod
 */
import PocketBase from "pocketbase";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
/** Canonical schema, shared with src/lib/setup/createCollections.ts. */
const SCHEMA = JSON.parse(readFileSync(join(here, "..", "pb_schema.json"), "utf8"));
/** Same template library the portal ships (src/lib/setup/seedTemplates.ts). */
const TEMPLATES = JSON.parse(
  readFileSync(join(here, "..", "src", "lib", "setup", "templates.json"), "utf8"),
);

const url = process.env.POCKETBASE_URL || "http://167.86.106.152:8093";
const adminEmail = process.env.PB_ADMIN_EMAIL || "";
const adminPassword = process.env.PB_ADMIN_PASSWORD || "";
const ownerEmail = process.env.SEED_OWNER_EMAIL || "rmolapisi@capacitiqgroup.co.za";
const ownerPassword = process.env.SEED_OWNER_PASSWORD || "";

const USER_FIELDS = SCHEMA.userFields;

const AUTODATE_FIELDS = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

function normalizeField(field) {
  const { options, ...rest } = field;
  const base = options ? { ...rest, ...options } : rest;
  return base.type === "select" ? { maxSelect: 1, ...base } : base;
}

function indexName(sql) {
  const match = /INDEX\s+`?([A-Za-z0-9_]+)`?/i.exec(sql);
  return match ? match[1] : sql;
}

const RULE_KEYS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];

/** Rules a definition asks for; serverOnly collections stay superuser-only. */
function rulesFor(def) {
  if (def.serverOnly) return Object.fromEntries(RULE_KEYS.map((k) => [k, null]));
  if (!def.rules) return {};
  return Object.fromEntries(RULE_KEYS.map((k) => [k, def.rules[k] ?? null]));
}

/** Creates missing collections, adds missing fields, indexes and API rules. */
async function provisionCollections(pb) {
  const existing = await pb.collections.getFullList();
  const byName = new Map(existing.map((c) => [c.name, c]));

  for (const def of SCHEMA.collections) {
    const fields = [...def.fields.map(normalizeField), ...AUTODATE_FIELDS];
    let live = byName.get(def.name);
    if (!live) {
      live = await pb.collections.create({
        name: def.name,
        type: def.type,
        fields,
        schema: fields,
        ...rulesFor(def),
      });
      log("collection created", def.name);
    } else {
      const current = live.fields ?? live.schema ?? [];
      const known = new Set(current.map((f) => f.name));
      const missing = fields.filter((f) => !known.has(f.name));
      if (missing.length > 0) {
        const merged = [...current, ...missing];
        live = await pb.collections.update(live.id, { fields: merged, schema: merged });
        log("collection fields added", `${def.name}: ${missing.map((f) => f.name).join(", ")}`);
      }
      // Only fill in rules that were never configured: never clobber rules an
      // operator set by hand on a live instance.
      if (!def.serverOnly && def.rules && RULE_KEYS.every((k) => !live[k])) {
        live = await pb.collections.update(live.id, rulesFor(def));
        log("collection rules applied", def.name);
      }
    }

    const wanted = def.indexes ?? [];
    if (wanted.length > 0) {
      const currentIndexes = live.indexes ?? [];
      const have = new Set(currentIndexes.map(indexName));
      const missingIndexes = wanted.filter((sql) => !have.has(indexName(sql)));
      if (missingIndexes.length > 0) {
        await pb.collections.update(live.id, { indexes: [...currentIndexes, ...missingIndexes] });
        log("indexes added", `${def.name}: ${missingIndexes.map(indexName).join(", ")}`);
      }
    }
  }
}


/**
 * Upserts every workflow template into `workflow_templates`, matched on
 * template_id. Templates added to src/lib/setup/templates.json therefore reach
 * the live portal on the next deploy, without anyone re-running /setup.
 */
async function syncTemplates(pb) {
  let created = 0;
  let updated = 0;
  for (const template of TEMPLATES) {
    const payload = {
      ...template,
      blocks: JSON.stringify(template.blocks),
      integrations_required: JSON.stringify(template.integrations_required),
    };
    let existing = null;
    try {
      existing = await pb
        .collection("workflow_templates")
        .getFirstListItem(pb.filter("template_id = {:id}", { id: template.template_id }));
    } catch {
      existing = null;
    }
    if (existing) {
      await pb.collection("workflow_templates").update(existing.id, payload);
      updated += 1;
    } else {
      await pb.collection("workflow_templates").create(payload);
      created += 1;
    }
  }
  log("workflow templates synced", `${created} created, ${updated} updated, ${TEMPLATES.length} total`);
}

function log(step, detail = "") {
  console.log(`[seed] ${step}${detail ? ` - ${detail}` : ""}`);
}

async function main() {
  if (!adminEmail || !adminPassword) {
    console.error("[seed] PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required. Skipping seed.");
    process.exit(process.env.SEED_STRICT === "true" ? 1 : 0);
  }
  if (!ownerPassword) {
    console.error("[seed] SEED_OWNER_PASSWORD is required. Skipping seed.");
    process.exit(process.env.SEED_STRICT === "true" ? 1 : 0);
  }

  const pb = new PocketBase(url);
  pb.autoCancellation(false);

  await pb.collection("_superusers").authWithPassword(adminEmail, adminPassword);
  log("authenticated as superuser", adminEmail);

  // 1. Superuser access for the owner account.
  let superuser = null;
  try {
    superuser = await pb
      .collection("_superusers")
      .getFirstListItem(pb.filter("email = {:email}", { email: ownerEmail }));
  } catch {
    superuser = null;
  }
  if (superuser) {
    await pb.collection("_superusers").update(superuser.id, {
      password: ownerPassword,
      passwordConfirm: ownerPassword,
    });
    log("superuser password reset", ownerEmail);
  } else {
    await pb.collection("_superusers").create({
      email: ownerEmail,
      password: ownerPassword,
      passwordConfirm: ownerPassword,
    });
    log("superuser created", ownerEmail);
  }

  // 1b. Provision every collection in the canonical schema (idempotent).
  await provisionCollections(pb);

  // 2. Make sure the users collection has every portal field.
  const users = await pb.collections.getFirstListItem('name = "users"');
  const current = users.fields ?? users.schema ?? [];
  const known = new Set(current.map((f) => f.name));
  const missing = USER_FIELDS.filter((f) => !known.has(f.name));
  if (missing.length > 0) {
    const merged = [...current, ...missing];
    await pb.collections.update(users.id, { fields: merged, schema: merged });
    log("added user fields", missing.map((f) => f.name).join(", "));
  } else {
    log("user fields already complete");
  }

  // 3. Portal login account.
  const trialEnds = new Date();
  trialEnds.setFullYear(trialEnds.getFullYear() + 1);
  const profile = {
    name: "Ratanang Molapisi",
    verified: true,
    is_tester: true,
    user_type: "beta",
    trial_ends_at: trialEnds.toISOString(),
    credit_emails: 100000,
    credit_workflows: 100000,
    notify_on_failure: true,
    notify_credit_low: true,
    onboarding_completed: true,
    onboarding_step: 5,
  };

  let record = null;
  try {
    record = await pb
      .collection("users")
      .getFirstListItem(pb.filter("email = {:email}", { email: ownerEmail }));
  } catch {
    record = null;
  }
  if (record) {
    await pb.collection("users").update(record.id, {
      ...profile,
      password: ownerPassword,
      passwordConfirm: ownerPassword,
    });
    log("portal user updated", ownerEmail);
  } else {
    await pb.collection("users").create({
      ...profile,
      email: ownerEmail,
      password: ownerPassword,
      passwordConfirm: ownerPassword,
    });
    log("portal user created", ownerEmail);
  }

  // 4. Workflow templates shown in the portal's Templates tab.
  await syncTemplates(pb);

  // 5. Prove the credentials actually work.
  const check = new PocketBase(url);
  await check.collection("users").authWithPassword(ownerEmail, ownerPassword);
  log("verified portal login", ownerEmail);

  console.log("[seed] done");
}

main().catch((err) => {
  console.error("[seed] failed:", err?.message || err);
  process.exit(1);
});
      
