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

const url = process.env.POCKETBASE_URL || "http://167.86.106.152:8093";
const adminEmail = process.env.PB_ADMIN_EMAIL || "";
const adminPassword = process.env.PB_ADMIN_PASSWORD || "";
const ownerEmail = process.env.SEED_OWNER_EMAIL || "rmolapisi@capacitiqgroup.co.za";
const ownerPassword = process.env.SEED_OWNER_PASSWORD || "";

const USER_FIELDS = [
  { name: "business_name", type: "text" },
  { name: "business_industry", type: "text" },
  { name: "business_address", type: "text" },
  { name: "whatsapp_number", type: "text" },
  { name: "review_link", type: "text" },
  { name: "is_tester", type: "bool" },
  { name: "user_type", type: "select", values: ["beta", "paid"], maxSelect: 1 },
  { name: "trial_ends_at", type: "date" },
  { name: "theme_preference", type: "select", values: ["dark", "light", "system"], maxSelect: 1 },
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
  // Plan + usage accounting. Mirrors src/lib/setup/createCollections.ts.
  { name: "tier", type: "select", values: ["free", "basic", "pro"], maxSelect: 1 },
  { name: "billing_period_start", type: "date" },
  { name: "executions_used_this_month", type: "number" },
  { name: "ai_ops_used_this_month", type: "number" },
  { name: "emails_used_this_month", type: "number" },
  { name: "storage_used_mb", type: "number" },
];

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

  // 4. Prove the credentials actually work.
  const check = new PocketBase(url);
  await check.collection("users").authWithPassword(ownerEmail, ownerPassword);
  log("verified portal login", ownerEmail);

  console.log("[seed] done");
}

main().catch((err) => {
  console.error("[seed] failed:", err?.message || err);
  process.exit(1);
});
