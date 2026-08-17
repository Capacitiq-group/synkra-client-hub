/**
 * Workspace / team / seat enforcement (authoritative, server only).
 *
 * Everything here runs with the PocketBase superuser client from
 * `@/lib/usage/pocketbase.server` — the browser never gets those credentials
 * and can never write membership, role or seat state directly.
 *
 * Seat limits come from `@/lib/plans` (single source of truth) through
 * computeSeatUsage in `@/lib/team/roles`. No seat numbers are hardcoded here.
 *
 * SECURITY: Always use pb.filter() for user-supplied values. Never interpolate.
 */
import type PocketBase from "pocketbase";
import { adminClient } from "@/lib/usage/pocketbase.server";
import { getPlanName, normalizeTier, type PlanTier } from "@/lib/plans";
import {
  can,
  computeSeatUsage,
  normalizeRole,
  seatLimitMessage,
  type AssignableRole,
  type Permission,
  type SeatUsage,
  type TeamActionError,
  type WorkspaceRole,
} from "./roles";

const INVITATION_TTL_DAYS = 7;

export class TeamError extends Error {
  code: TeamActionError;
  constructor(code: TeamActionError, message: string) {
    super(message);
    this.code = code;
  }
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerId: string;
  isDefault: boolean;
  created: string;
}

export interface MemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: "active" | "removed";
  joinedAt: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: "pending" | "accepted" | "cancelled" | "expired";
  invitedBy: string;
  expiresAt: string;
  created: string;
}

export interface WorkspaceOverview {
  workspace: WorkspaceRecord | null;
  /** The caller's role in that workspace (null when they have no workspace). */
  role: WorkspaceRole | null;
  owner: { id: string; name: string; email: string } | null;
  tier: PlanTier;
  planName: string;
  seats: SeatUsage;
  members: MemberRecord[];
  invitations: InvitationRecord[];
  /** True when the caller may create their (one permitted) workspace. */
  canCreateWorkspace: boolean;
}

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function toWorkspace(record: Record<string, unknown>): WorkspaceRecord {
  return {
    id: str(record, "id"),
    name: str(record, "name"),
    ownerId: str(record, "owner_id"),
    isDefault: Boolean(record["is_default"]),
    created: str(record, "created"),
  };
}

export function normalizeEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new TeamError("invalid_email", "Enter a valid email address.");
  }
  return email;
}

function invitationExpired(record: Record<string, unknown>, now: Date): boolean {
  const raw = str(record, "expires_at");
  if (!raw) return false;
  const at = new Date(raw.replace(" ", "T"));
  return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime();
}

/* ------------------------------------------------------------------ */
/* Workspace + membership lookups                                      */
/* ------------------------------------------------------------------ */

async function findOwnedWorkspace(pb: PocketBase, userId: string) {
  const owned = await pb.collection("workspaces").getFullList({
    filter: pb.filter("owner_id = {:userId}", { userId }),
    sort: "created",
  });
  return (owned[0] as unknown as Record<string, unknown> | undefined) ?? null;
}

async function findMembership(pb: PocketBase, workspaceId: string, userId: string) {
  try {
    const record = await pb
      .collection("workspace_members")
      .getFirstListItem(
        pb.filter("workspace_id = {:workspaceId} && user_id = {:userId}", { workspaceId, userId }),
      );
    return record as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Guarantees the workspace owner always has an active owner membership row, so
 * the owner reliably occupies exactly one seat and can never be "removed" by
 * simply deleting a membership record.
 */
async function ensureOwnerMembership(pb: PocketBase, workspace: Record<string, unknown>) {
  const workspaceId = str(workspace, "id");
  const ownerId = str(workspace, "owner_id");
  const existing = await findMembership(pb, workspaceId, ownerId);
  if (existing) {
    if (normalizeRole(existing["role"]) !== "owner" || existing["status"] !== "active") {
      await pb
        .collection("workspace_members")
        .update(str(existing, "id"), { role: "owner", status: "active" });
    }
    return;
  }
  let email = "";
  let name = "";
  try {
    const user = (await pb.collection("users").getOne(ownerId)) as unknown as Record<
      string,
      unknown
    >;
    email = str(user, "email");
    name = str(user, "name");
  } catch {
    /* owner record unavailable; membership is still created */
  }
  await pb.collection("workspace_members").create({
    workspace_id: workspaceId,
    user_id: ownerId,
    email,
    name,
    role: "owner",
    status: "active",
    joined_at: str(workspace, "created") || new Date().toISOString(),
  });
}

/** The workspace the user belongs to: the one they own, else the one they joined. */
async function resolveWorkspace(pb: PocketBase, userId: string) {
  const owned = await findOwnedWorkspace(pb, userId);
  if (owned) {
    await ensureOwnerMembership(pb, owned);
    return { workspace: owned, role: "owner" as WorkspaceRole };
  }
  const memberships = await pb.collection("workspace_members").getFullList({
    filter: pb.filter("user_id = {:userId} && status = 'active'", { userId }),
    sort: "created",
  });
  const membership = memberships[0] as unknown as Record<string, unknown> | undefined;
  if (!membership) return { workspace: null, role: null };
  try {
    const workspace = (await pb
      .collection("workspaces")
      .getOne(str(membership, "workspace_id"))) as unknown as Record<string, unknown>;
    return { workspace, role: normalizeRole(membership["role"]) };
  } catch {
    return { workspace: null, role: null };
  }
}

/** Lazily flips elapsed invitations to `expired` so their seat is released. */
async function expirePendingInvitations(pb: PocketBase, workspaceId: string) {
  const now = new Date();
  const pending = await pb.collection("workspace_invitations").getFullList({
    filter: pb.filter("workspace_id = {:workspaceId} && status = 'pending'", { workspaceId }),
  });
  for (const raw of pending) {
    const record = raw as unknown as Record<string, unknown>;
    if (invitationExpired(record, now)) {
      await pb.collection("workspace_invitations").update(str(record, "id"), {
        status: "expired",
      });
    }
  }
}

async function ownerTier(pb: PocketBase, ownerId: string): Promise<PlanTier> {
  try {
    const owner = (await pb.collection("users").getOne(ownerId)) as unknown as Record<
      string,
      unknown
    >;
    return normalizeTier(owner["tier"]);
  } catch {
    return "free";
  }
}

export interface WorkspaceContext {
  pb: PocketBase;
  userId: string;
  workspace: WorkspaceRecord;
  role: WorkspaceRole;
  tier: PlanTier;
  seats: SeatUsage;
  members: MemberRecord[];
  invitations: InvitationRecord[];
}

/** Loads the caller's workspace and re-verifies membership + seat state. */
export async function loadWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  const pb = await adminClient();
  const { workspace, role } = await resolveWorkspace(pb, userId);
  if (!workspace || !role) {
    throw new TeamError("not_a_member", "You do not belong to a workspace yet.");
  }
  const workspaceId = str(workspace, "id");
  await expirePendingInvitations(pb, workspaceId);

  const memberRows = await pb.collection("workspace_members").getFullList({
    filter: pb.filter("workspace_id = {:workspaceId}", { workspaceId }),
    sort: "created",
  });
  const invitationRows = await pb.collection("workspace_invitations").getFullList({
    filter: pb.filter("workspace_id = {:workspaceId}", { workspaceId }),
    sort: "-created",
  });

  const members: MemberRecord[] = memberRows.map((raw) => {
    const record = raw as unknown as Record<string, unknown>;
    return {
      id: str(record, "id"),
      userId: str(record, "user_id"),
      name: str(record, "name"),
      email: str(record, "email"),
      role: normalizeRole(record["role"]),
      status: record["status"] === "removed" ? "removed" : "active",
      joinedAt: str(record, "joined_at") || str(record, "created"),
    };
  });

  const invitations: InvitationRecord[] = invitationRows.map((raw) => {
    const record = raw as unknown as Record<string, unknown>;
    const status = str(record, "status");
    return {
      id: str(record, "id"),
      email: str(record, "email"),
      role: normalizeRole(record["role"]),
      status:
        status === "accepted" || status === "cancelled" || status === "expired"
          ? status
          : "pending",
      invitedBy: str(record, "invited_by"),
      expiresAt: str(record, "expires_at"),
      created: str(record, "created"),
    };
  });

  const tier = await ownerTier(pb, str(workspace, "owner_id"));
  const seats = computeSeatUsage(
    tier,
    members.filter((m) => m.status === "active").length,
    invitations.filter((i) => i.status === "pending").length,
  );

  return {
    pb,
    userId,
    workspace: toWorkspace(workspace),
    role,
    tier,
    seats,
    members,
    invitations,
  };
}

function assertPermission(ctx: WorkspaceContext, permission: Permission) {
  if (!can(ctx.role, permission)) {
    throw new TeamError("forbidden", "You do not have permission to perform this action.");
  }
}

/* ------------------------------------------------------------------ */
/* Read model                                                          */
/* ------------------------------------------------------------------ */

export async function getWorkspaceOverview(userId: string): Promise<WorkspaceOverview> {
  const pb = await adminClient();
  let { workspace } = await resolveWorkspace(pb, userId);

  // Every account owns a workspace. Provisioning it here (instead of asking the
  // user to create one) is what stops a freshly provisioned or freshly paid
  // account from landing on "Could not load your workspace".
  if (!workspace) {
    try {
      await ensureWorkspaceForOwner(userId);
      ({ workspace } = await resolveWorkspace(pb, userId));
    } catch {
      /* fall through to the create-workspace state below */
    }
  }

  if (!workspace) {
    const tier = await ownerTier(pb, userId);
    return {
      workspace: null,
      role: null,
      owner: null,
      tier,
      planName: getPlanName(tier),
      seats: computeSeatUsage(tier, 0, 0),
      members: [],
      invitations: [],
      canCreateWorkspace: true,
    };
  }


  const ctx = await loadWorkspaceContext(userId);
  let owner: WorkspaceOverview["owner"] = null;
  try {
    const record = (await pb.collection("users").getOne(ctx.workspace.ownerId)) as unknown as Record<
      string,
      unknown
    >;
    owner = { id: ctx.workspace.ownerId, name: str(record, "name"), email: str(record, "email") };
  } catch {
    owner = { id: ctx.workspace.ownerId, name: "", email: "" };
  }

  return {
    workspace: ctx.workspace,
    role: ctx.role,
    owner,
    tier: ctx.tier,
    planName: getPlanName(ctx.tier),
    seats: ctx.seats,
    members: ctx.members,
    invitations: ctx.invitations,
    // Every current plan allows exactly one workspace, and the caller already
    // belongs to one.
    canCreateWorkspace: false,
  };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function renameWorkspace(userId: string, name: string) {
  const ctx = await loadWorkspaceContext(userId);
  assertPermission(ctx, "workspace.update");
  const clean = name.trim();
  if (!clean) throw new TeamError("not_found", "Enter a workspace name.");
  await ctx.pb.collection("workspaces").update(ctx.workspace.id, { name: clean });
  return { ok: true as const, name: clean };
}

export interface InviteInput {
  userId: string;
  email: string;
  role: AssignableRole;
}

export async function inviteMember(input: InviteInput) {
  const ctx = await loadWorkspaceContext(input.userId);
  assertPermission(ctx, "team.invite");

  const role = normalizeRole(input.role);
  if (role === "owner") {
    throw new TeamError("invalid_role", "Members cannot be invited as the workspace owner.");
  }
  const email = normalizeEmail(input.email);

  if (ctx.members.some((m) => m.status === "active" && m.email.toLowerCase() === email)) {
    throw new TeamError("duplicate_member", "That person is already a member of this workspace.");
  }
  if (ctx.invitations.some((i) => i.status === "pending" && i.email.toLowerCase() === email)) {
    throw new TeamError(
      "duplicate_invitation",
      "There is already a pending invitation for that email address.",
    );
  }
  if (ctx.seats.available <= 0) {
    throw new TeamError("seat_limit_reached", seatLimitMessage(ctx.seats, getPlanName(ctx.tier)));
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const record = await ctx.pb.collection("workspace_invitations").create({
    workspace_id: ctx.workspace.id,
    email,
    role,
    status: "pending",
    token: crypto.randomUUID(),
    invited_by: ctx.userId,
    expires_at: expiresAt,
  });

  return { ok: true as const, invitationId: record.id, email, role, expiresAt };
}

export async function cancelInvitation(userId: string, invitationId: string) {
  const ctx = await loadWorkspaceContext(userId);
  assertPermission(ctx, "team.invite");
  const invitation = ctx.invitations.find((i) => i.id === invitationId);
  if (!invitation) throw new TeamError("not_found", "That invitation no longer exists.");
  if (invitation.status !== "pending") {
    throw new TeamError("not_found", "That invitation is no longer pending.");
  }
  await ctx.pb.collection("workspace_invitations").update(invitationId, { status: "cancelled" });
  return { ok: true as const };
}

/**
 * Accepts an invitation for the authenticated caller. The seat is re-checked
 * at acceptance time so a downgrade between invite and accept cannot push the
 * workspace over its allowance.
 */
export async function acceptInvitation(userId: string, token: string) {
  const pb = await adminClient();
  let raw: Record<string, unknown>;
  try {
    raw = (await pb
      .collection("workspace_invitations")
      .getFirstListItem(pb.filter("token = {:token}", { token }))) as unknown as Record<
      string,
      unknown
    >;
  } catch {
    throw new TeamError("not_found", "This invitation is not valid.");
  }
  if (str(raw, "status") !== "pending") {
    throw new TeamError("not_found", "This invitation is no longer available.");
  }
  if (invitationExpired(raw, new Date())) {
    await pb.collection("workspace_invitations").update(str(raw, "id"), { status: "expired" });
    throw new TeamError("invitation_expired", "This invitation has expired.");
  }

  const user = (await pb.collection("users").getOne(userId)) as unknown as Record<string, unknown>;
  const email = str(user, "email").toLowerCase();
  if (email !== str(raw, "email").toLowerCase()) {
    throw new TeamError("forbidden", "This invitation was sent to a different email address.");
  }

  const workspaceId = str(raw, "workspace_id");
  const workspace = (await pb.collection("workspaces").getOne(workspaceId)) as unknown as Record<
    string,
    unknown
  >;
  await ensureOwnerMembership(pb, workspace);
  await expirePendingInvitations(pb, workspaceId);

  const members = await pb.collection("workspace_members").getFullList({
    filter: pb.filter("workspace_id = {:workspaceId} && status = 'active'", { workspaceId }),
  });
  const pending = await pb.collection("workspace_invitations").getFullList({
    filter: pb.filter("workspace_id = {:workspaceId} && status = 'pending'", { workspaceId }),
  });
  const tier = await ownerTier(pb, str(workspace, "owner_id"));
  // The invitation itself already reserves one of the pending seats.
  const seats = computeSeatUsage(tier, members.length, Math.max(0, pending.length - 1));
  if (seats.available <= 0) {
    throw new TeamError("seat_limit_reached", seatLimitMessage(seats, getPlanName(tier)));
  }

  const existing = await findMembership(pb, workspaceId, userId);
  if (existing) {
    await pb.collection("workspace_members").update(str(existing, "id"), {
      status: "active",
      role: normalizeRole(raw["role"]),
      joined_at: new Date().toISOString(),
    });
  } else {
    await pb.collection("workspace_members").create({
      workspace_id: workspaceId,
      user_id: userId,
      email,
      name: str(user, "name"),
      role: normalizeRole(raw["role"]),
      status: "active",
      invited_by: str(raw, "invited_by"),
      joined_at: new Date().toISOString(),
    });
  }

  await pb.collection("workspace_invitations").update(str(raw, "id"), {
    status: "accepted",
    accepted_at: new Date().toISOString(),
  });

  return { ok: true as const, workspaceId };
}

export async function removeMember(userId: string, memberId: string) {
  const ctx = await loadWorkspaceContext(userId);
  assertPermission(ctx, "team.remove");
  const member = ctx.members.find((m) => m.id === memberId);
  if (!member || member.status !== "active") {
    throw new TeamError("not_found", "That member is not part of this workspace.");
  }
  if (member.role === "owner" || member.userId === ctx.workspace.ownerId) {
    throw new TeamError(
      "owner_protected",
      "The workspace owner cannot be removed. Ownership transfer is not available yet.",
    );
  }
  if (member.userId === ctx.userId) {
    throw new TeamError("forbidden", "You cannot remove yourself from the workspace.");
  }
  if (ctx.role === "admin" && member.role === "admin") {
    throw new TeamError("forbidden", "Only the workspace owner can remove another admin.");
  }

  // Membership only. Workflows, runs and other business data created by this
  // person are intentionally preserved.
  await ctx.pb.collection("workspace_members").update(memberId, { status: "removed" });
  return { ok: true as const };
}

export async function changeMemberRole(userId: string, memberId: string, role: AssignableRole) {
  const ctx = await loadWorkspaceContext(userId);
  assertPermission(ctx, "team.role.change");
  const next = normalizeRole(role);
  if (next === "owner") {
    throw new TeamError(
      "owner_protected",
      "Ownership transfer is not available yet, so nobody can be promoted to Owner.",
    );
  }
  const member = ctx.members.find((m) => m.id === memberId);
  if (!member || member.status !== "active") {
    throw new TeamError("not_found", "That member is not part of this workspace.");
  }
  if (member.role === "owner" || member.userId === ctx.workspace.ownerId) {
    throw new TeamError("owner_protected", "The workspace owner's role cannot be changed.");
  }
  if (member.userId === ctx.userId) {
    throw new TeamError("forbidden", "You cannot change your own role.");
  }
  if (ctx.role === "admin" && member.role === "admin") {
    throw new TeamError("forbidden", "Only the workspace owner can change an admin's role.");
  }
  await ctx.pb.collection("workspace_members").update(memberId, { role: next });
  return { ok: true as const, role: next };
}

/**
 * Permission gate for any other server-side action that needs a workspace
 * role check (billing, connections, workflow management).
 */
export async function requirePermission(userId: string, permission: Permission) {
  const ctx = await loadWorkspaceContext(userId);
  assertPermission(ctx, permission);
  return ctx;
}

/**
 * Guarantees the account owns a workspace and is its owner-member.
 *
 * Called when a plan is activated (and lazily by the workspace read model) so
 * a paying customer can never land in the portal without a workspace — the
 * state that produced "Could not load your workspace". Respects the
 * one-workspace-per-plan rule: an existing owned workspace is reused, and a
 * user who is only a member of somebody else's workspace never gets a second
 * one.
 */
export async function ensureWorkspaceForOwner(
  userId: string,
  preferredName?: string,
): Promise<WorkspaceRecord> {
  const pb = await adminClient();

  const owned = await findOwnedWorkspace(pb, userId);
  if (owned) {
    await ensureOwnerMembership(pb, owned);
    return toWorkspace(owned);
  }

  // Already a member of somebody else's workspace: that is their workspace.
  const { workspace: joined } = await resolveWorkspace(pb, userId);
  if (joined) return toWorkspace(joined);

  let name = preferredName?.trim() ?? "";
  if (!name) {
    try {
      const user = (await pb.collection("users").getOne(userId)) as unknown as Record<
        string,
        unknown
      >;
      name = str(user, "business_name") || str(user, "name") || "My workspace";
    } catch {
      name = "My workspace";
    }
  }

  const created = (await pb.collection("workspaces").create({
    owner_id: userId,
    name: name.slice(0, 120),
    is_default: true,
  })) as unknown as Record<string, unknown>;
  await ensureOwnerMembership(pb, created);
  return toWorkspace(created);
}
