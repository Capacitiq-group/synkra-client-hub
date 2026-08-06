#!/usr/bin/env node
/**
 * Post-deploy smoke test for the Synkra client portal.
 *
 * Checks, in order:
 *   1. PocketBase health and the portal HTTP entry point
 *   2. Owner login with the seeded credentials
 *   3. Realtime activity updates (subscribe, write, receive)
 *   4. Template publishing (create a workflow from a template, publish it)
 *   5. Notification email trigger through the portal server route
 *
 * Env:
 *   POCKETBASE_URL, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
 *   APP_URL              portal base URL, e.g. https://client.synkra.co.za
 *   SMOKE_NOTIFY_EMAIL   optional, where the test email goes
 */
import PocketBase from "pocketbase";

// PocketBase realtime needs EventSource. Node exposes it only behind a flag on
// some releases, so fall back to undici's implementation when it is missing.
if (typeof globalThis.EventSource === "undefined") {
  try {
    const undici = await import("undici");
    if (undici.EventSource) globalThis.EventSource = undici.EventSource;
  } catch {
    console.warn("[smoke] EventSource unavailable, run node with --experimental-eventsource");
  }
}


const url = process.env.POCKETBASE_URL || "http://167.86.106.152:8093";
const appUrl = (process.env.APP_URL || "").replace(/\/+$/, "");
const email = process.env.SEED_OWNER_EMAIL || "rmolapisi@capacitiqgroup.co.za";
const password = process.env.SEED_OWNER_PASSWORD || "";

const results = [];
async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail: detail || "" });
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ""}`);
    return true;
  } catch (err) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      detail: err?.message || String(err),
    });
    console.error(`FAIL  ${name}: ${err?.message || err}`);
    return false;
  }
}

const pb = new PocketBase(url);
pb.autoCancellation(false);
const cleanup = [];

async function run() {
  await step("PocketBase health", async () => {
    const res = await fetch(`${url}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return "healthy";
  });

  if (appUrl) {
    await step("Portal responds", async () => {
      const res = await fetch(`${appUrl}/login`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      return `${res.status}`;
    });
  }

  const loggedIn = await step("Owner login", async () => {
    if (!password) throw new Error("SEED_OWNER_PASSWORD is not set");
    const auth = await pb.collection("users").authWithPassword(email, password);
    return auth.record.id;
  });
  if (!loggedIn) return finish();

  const userId = pb.authStore.record.id;

  let workflowId = null;
  await step("Template publishing", async () => {
    const templates = await pb.collection("workflow_templates").getList(1, 1, {
      filter: "is_active = true",
    });
    const template = templates.items[0];
    if (!template) throw new Error("no active templates found");
    const workflow = await pb.collection("workflows").create({
      user_id: userId,
      template_id: template.template_id || template.id,
      name: `Smoke test ${new Date().toISOString()}`,
      status: "draft",
      blocks: template.blocks || [],
    });
    workflowId = workflow.id;
    cleanup.push(() => pb.collection("workflows").delete(workflowId));
    const published = await pb.collection("workflows").update(workflowId, { status: "published" });
    if (published.status !== "published") throw new Error("workflow did not publish");
    return template.name;
  });

  await step("Realtime activity updates", async () => {
    if (!workflowId) throw new Error("no workflow to run against");
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no realtime event within 15s")), 15000);
      pb.collection("workflow_runs").subscribe("*", (event) => {
        if (event.record.workflow_id === workflowId && event.action === "update") {
          clearTimeout(timer);
          resolve(event.record.status);
        }
      });
    });
    const run = await pb.collection("workflow_runs").create({
      workflow_id: workflowId,
      user_id: userId,
      status: "running",
      triggered_at: new Date().toISOString(),
    });
    cleanup.push(() => pb.collection("workflow_runs").delete(run.id));
    await new Promise((r) => setTimeout(r, 800));
    await pb.collection("workflow_runs").update(run.id, {
      status: "failed",
      error_message: "Smoke test synthetic failure",
      completed_at: new Date().toISOString(),
    });
    const status = await received;
    await pb.collection("workflow_runs").unsubscribe("*");
    return `received ${status}`;
  });

  if (appUrl) {
    await step("Notification email trigger", async () => {
      const res = await fetch(`${appUrl}/api/public/notifications/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: process.env.SMOKE_NOTIFY_EMAIL || email,
          subject: "Synkra deploy smoke test",
          body: "This message confirms notification delivery after a deploy.",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.ok !== true) {
        throw new Error(`status ${res.status} ${JSON.stringify(payload)}`);
      }
      return "queued";
    });
  }

  return finish();
}

async function finish() {
  for (const fn of cleanup.reverse()) {
    try {
      await fn();
    } catch {
      // best effort cleanup
    }
  }
  pb.authStore.clear();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("smoke test crashed:", err?.message || err);
  process.exit(1);
});
