process.env.POCKETBASE_URL='https://pb.synkra.co.za';
process.env.PB_ADMIN_EMAIL=process.env.PB_EMAIL!;
process.env.PB_ADMIN_PASSWORD=process.env.PB_PASSWORD!;
import PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { issueMagicLink, consumeMagicLink } from "@/lib/billing/billing.server";

const pb = await adminClient();
const u = await pb.collection("users").getFirstListItem(pb.filter("email = {:e}", { e: "tester@synkra.co.za" }));
const link1 = await issueMagicLink(pb, { userId: u.id, email: u.email, purpose: "test" });
const t1 = new URL(link1).searchParams.get("token")!;
const link2 = await issueMagicLink(pb, { userId: u.id, email: u.email, purpose: "test" });
const t2 = new URL(link2).searchParams.get("token")!;
try { await consumeMagicLink(t1); console.log("FAIL: old token still worked"); }
catch (e) { console.log("old token rejected:", (e as Error).message); }
const s = await consumeMagicLink(t2);
console.log("new token accepted, session user:", (s.record as any).id, "same id:", (s.record as any).id === u.id);
try { await consumeMagicLink(t2); console.log("FAIL: reuse worked"); }
catch (e) { console.log("reuse rejected:", (e as Error).message); }
// expiry check
const rec = await pb.collection("magic_links").create({ user_id: u.id, email: u.email, token_hash: "x", purpose: "test", expires_at: new Date(Date.now()-1000).toISOString() });
const expiredToken = "e".repeat(64);
const { createHash } = await import("node:crypto");
await pb.collection("magic_links").update(rec.id, { token_hash: createHash("sha256").update(expiredToken).digest("hex"), used_at: "" });
try { await consumeMagicLink(expiredToken); console.log("FAIL: expired worked"); }
catch (e) { console.log("expired rejected:", (e as Error).message); }
const after = await pb.collection("users").getOne(u.id);
console.log("user intact after expiry:", after.id === u.id, "tier:", after.tier || "(empty→free)");

// client-side tier escalation attempt with the real user session
const client = new PocketBase("https://pb.synkra.co.za");
client.authStore.save(s.token, s.record as any);
try { await client.collection("users").update(u.id, { tier: "pro" }); console.log("SECURITY FAIL: client set tier"); }
catch (e) { console.log("client tier write blocked:", (e as any).status, (e as Error).message); }
try { const r = await client.collection("users").update(u.id, { name: after.name || "Tester" }); console.log("client normal profile update ok:", !!r.id); }
catch (e) { console.log("FAIL normal update blocked:", (e as Error).message); }
await pb.collection("magic_links").delete(rec.id);
