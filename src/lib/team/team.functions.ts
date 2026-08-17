/**
 * Client-callable workspace / team endpoints.
 *
 * Every handler re-verifies the caller's PocketBase token server-side and then
 * re-checks workspace membership, role, permission and seat availability. UI
 * visibility is never the authorisation boundary.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10) });
const roleSchema = z.enum(["admin", "member"]);

const inviteSchema = tokenSchema.extend({
  email: z.string().min(3).max(200),
  role: roleSchema,
});
const memberSchema = tokenSchema.extend({ memberId: z.string().min(1) });
const roleChangeSchema = memberSchema.extend({ role: roleSchema });
const invitationSchema = tokenSchema.extend({ invitationId: z.string().min(1) });
const acceptSchema = tokenSchema.extend({ token2: z.string().min(8) });
const renameSchema = tokenSchema.extend({ name: z.string().min(1).max(120) });

type Failure = { ok: false; error: string; message: string };

async function guard<T>(run: () => Promise<T>): Promise<T | Failure> {
  const { TeamError } = await import("./team.server");
  try {
    return await run();
  } catch (err) {
    if (err instanceof TeamError) {
      return { ok: false as const, error: err.code, message: err.message };
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return {
      ok: false as const,
      error: message === "Not authenticated" ? "not_authenticated" : "unknown",
      message,
    };
  }
}

/** Workspace + team read model for the settings UI. */
export const getWorkspaceOverviewFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { getWorkspaceOverview } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(async () => ({ ok: true as const, ...(await getWorkspaceOverview(userId)) }));
  });

export const renameWorkspaceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => renameSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { renameWorkspace } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => renameWorkspace(userId, data.name));
  });

export const inviteMemberFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { inviteMember } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => inviteMember({ userId, email: data.email, role: data.role }));
  });

export const cancelInvitationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => invitationSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { cancelInvitation } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => cancelInvitation(userId, data.invitationId));
  });

export const acceptInvitationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => acceptSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { acceptInvitation } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => acceptInvitation(userId, data.token2));
  });

export const removeMemberFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => memberSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { removeMember } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => removeMember(userId, data.memberId));
  });

export const changeMemberRoleFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => roleChangeSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyUserToken } = await import("@/lib/usage/pocketbase.server");
    const { changeMemberRole } = await import("./team.server");
    const { userId } = await verifyUserToken(data.token);
    return guard(() => changeMemberRole(userId, data.memberId, data.role));
  });
