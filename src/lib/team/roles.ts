/**
 * Workspace roles, permissions and seat arithmetic (client-safe, pure).
 *
 * Seat limits are NEVER defined here — they come from the single source of
 * truth in `@/lib/plans` via getSeatLimit(). This module only decides what a
 * role is allowed to do and how many seats are currently occupied.
 *
 * The owner ALWAYS occupies one seat. A pending (not expired, not cancelled)
 * invitation reserves a seat so nobody can bypass the limit by inviting
 * unlimited people.
 */
import { getSeatLimit, normalizeTier, type PlanTier } from "@/lib/plans";

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be handed out through the invite / role-change UI. */
export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const MEMBER_STATUSES = ["active", "removed"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "cancelled", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export type Permission =
  | "workspace.view"
  | "workspace.update"
  | "workspace.delete"
  | "workspace.create"
  | "team.view"
  | "team.invite"
  | "team.remove"
  | "team.role.change"
  | "ownership.transfer"
  | "billing.manage"
  | "billing.view"
  | "workflow.view"
  | "workflow.create"
  | "workflow.edit"
  | "workflow.delete"
  | "workflow.activate"
  | "workflow.run"
  | "connections.manage"
  | "usage.view";

const OWNER_PERMISSIONS: Permission[] = [
  "workspace.view",
  "workspace.update",
  "workspace.delete",
  "workspace.create",
  "team.view",
  "team.invite",
  "team.remove",
  "team.role.change",
  "ownership.transfer",
  "billing.manage",
  "billing.view",
  "workflow.view",
  "workflow.create",
  "workflow.edit",
  "workflow.delete",
  "workflow.activate",
  "workflow.run",
  "connections.manage",
  "usage.view",
];

const ADMIN_PERMISSIONS: Permission[] = [
  "workspace.view",
  "workspace.update",
  "team.view",
  "team.invite",
  "team.remove",
  "team.role.change",
  "workflow.view",
  "workflow.create",
  "workflow.edit",
  "workflow.delete",
  "workflow.activate",
  "workflow.run",
  "connections.manage",
  "usage.view",
];

const MEMBER_PERMISSIONS: Permission[] = [
  "workspace.view",
  "team.view",
  "workflow.view",
  "workflow.create",
  "workflow.edit",
  "workflow.activate",
  "workflow.run",
  "usage.view",
];

export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: OWNER_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  member: MEMBER_PERMISSIONS,
};

export function normalizeRole(value: unknown): WorkspaceRole {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (WORKSPACE_ROLES as readonly string[]).includes(role) ? (role as WorkspaceRole) : "member";
}

export function can(role: unknown, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(permission);
}

export function roleLabel(role: unknown): string {
  const r = normalizeRole(role);
  return r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member";
}

/* ------------------------------------------------------------------ */
/* Seat arithmetic                                                     */
/* ------------------------------------------------------------------ */

export interface SeatUsage {
  tier: PlanTier;
  /** Seat allowance for the owner's tier, owner included. */
  limit: number;
  /** Active memberships, owner included. */
  activeMembers: number;
  /** Pending invitations still holding a seat. */
  pendingInvitations: number;
  /** activeMembers + pendingInvitations. */
  used: number;
  /** Never negative. 0 when the workspace is at or over the allowance. */
  available: number;
  /** True after a downgrade left more people in the workspace than allowed. */
  overLimit: boolean;
}

export function computeSeatUsage(
  tierInput: unknown,
  activeMembers: number,
  pendingInvitations: number,
): SeatUsage {
  const tier = normalizeTier(tierInput);
  const limit = getSeatLimit(tier);
  const active = Math.max(0, Math.trunc(activeMembers));
  const pending = Math.max(0, Math.trunc(pendingInvitations));
  const used = active + pending;
  return {
    tier,
    limit,
    activeMembers: active,
    pendingInvitations: pending,
    used,
    available: Math.max(0, limit - used),
    overLimit: used > limit,
  };
}

export function seatSummary(usage: SeatUsage): string {
  return `${usage.used} / ${usage.limit} ${usage.limit === 1 ? "seat" : "seats"} used`;
}

export function seatLimitMessage(usage: SeatUsage, planName: string): string {
  return `Your workspace has reached the ${usage.limit}-seat limit for the ${planName} plan.`;
}

/** Every current plan allows exactly one workspace, so never promise more. */
export const WORKSPACE_LIMIT_MESSAGE = "Your current plan supports 1 workspace.";

export type TeamActionError =
  | "not_authenticated"
  | "not_a_member"
  | "forbidden"
  | "seat_limit_reached"
  | "duplicate_member"
  | "duplicate_invitation"
  | "invalid_role"
  | "owner_protected"
  | "not_found"
  | "invalid_email"
  | "invitation_expired";
