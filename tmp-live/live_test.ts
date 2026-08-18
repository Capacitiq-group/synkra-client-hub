process.env.POCKETBASE_URL='https://pb.synkra.co.za';
process.env.PB_ADMIN_EMAIL=process.env.PB_EMAIL!;
process.env.PB_ADMIN_PASSWORD=process.env.PB_PASSWORD!;
import { adminClient } from "@/lib/usage/pocketbase.server";
import { ensureWorkspaceForOwner, getWorkspaceOverview } from "@/lib/team/team.server";

const pb = await adminClient();
const users = await pb.collection("users").getFullList({ sort: "created" });
console.log("users:", users.length, users.map(u=>u.id+":"+u.email+":"+u.tier).join(", "));
const u = users[0]!;
const w1 = await ensureWorkspaceForOwner(u.id);
const w2 = await ensureWorkspaceForOwner(u.id);
console.log("workspace1", JSON.stringify(w1));
console.log("workspace2", JSON.stringify(w2));
const all = await pb.collection("workspaces").getFullList({ filter: pb.filter("owner_id = {:id}",{id:u.id}) });
const mem = await pb.collection("workspace_members").getFullList({ filter: pb.filter("user_id = {:id}",{id:u.id}) });
console.log("owned workspaces:", all.length, "memberships:", mem.length, mem.map(m=>m.role+"/"+m.status).join(","));
const ctx = await getWorkspaceOverview(u.id);
console.log("context:", JSON.stringify(ctx).slice(0,600));
