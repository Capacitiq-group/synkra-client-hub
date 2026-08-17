import { useState } from "react";
import { toast } from "sonner";
import { Shimmer, SectionError } from "@/components/dashboard/primitives";
import { SettingsSection, Field, fieldStyle } from "@/components/settings/settings-primitives";
import { useWorkspaceOverview, useTeamActions } from "@/hooks/useWorkspaceTeam";
import {
  can,
  roleLabel,
  seatSummary,
  WORKSPACE_LIMIT_MESSAGE,
  type AssignableRole,
} from "@/lib/team/roles";

function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function Pill({ label, tone }: { label: string; tone: "ok" | "muted" | "warn" }) {
  const colors = {
    ok: { bg: "var(--state-success-bg)", color: "var(--state-success)" },
    warn: { bg: "var(--state-warning-bg)", color: "var(--state-warning)" },
    muted: { bg: "var(--border-subtle)", color: "var(--text-muted)" },
  }[tone];
  return (
    <span
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-card)" }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1" style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function CreateWorkspace() {
  const { createWorkspace } = useTeamActions();
  const [name, setName] = useState("");
  return (
    <SettingsSection title="Create your workspace">
      <p className="mb-4" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        A workspace holds your workflows, team, connections and usage.{" "}
        {WORKSPACE_LIMIT_MESSAGE}
      </p>
      <form
        className="flex max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          createWorkspace.mutate(name.trim(), {
            onSuccess: () => toast.success("Workspace created"),
            onError: (error: Error) => toast.error(error.message),
          });
        }}
      >
        <Field label="Workspace name">
          <input
            style={fieldStyle}
            value={name}
            maxLength={120}
            required
            placeholder="Acme Transport"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <button
          type="submit"
          disabled={createWorkspace.isPending || name.trim().length === 0}
          className="synkra-focus h-11 rounded-md px-5"
          style={{
            backgroundColor: "var(--accent-green)",
            color: "var(--bg-base)",
            fontWeight: 600,
            fontSize: 14,
            opacity: createWorkspace.isPending || !name.trim() ? 0.6 : 1,
          }}
        >
          {createWorkspace.isPending ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </SettingsSection>
  );
}

export function WorkspaceSettings() {
  const { data, isLoading, isError, refetch } = useWorkspaceOverview();
  const { renameWorkspace, invite, cancelInvite, removeMember, changeRole } = useTeamActions();
  const [name, setName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("member");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Shimmer height={92} />
        <Shimmer height={220} />
      </div>
    );
  }
  if (isError || !data) return <SectionError label="your workspace" onRetry={() => refetch()} />;
  if (!data.workspace) return <CreateWorkspace />;

  const role = data.role ?? "member";
  const seats = data.seats;
  const activeMembers = data.members.filter((m) => m.status === "active");
  const pending = data.invitations.filter((i) => i.status === "pending");
  const canInvite = can(role, "team.invite");
  const canManageTeam = can(role, "team.remove") || can(role, "team.role.change");
  const canRename = can(role, "workspace.update");
  const workspaceName = name ?? data.workspace.name;

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title="Workspace">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile label="Workspace" value={data.workspace.name} />
          <InfoTile label="Owner" value={data.owner?.name || data.owner?.email || "—"} />
          <InfoTile label="Plan" value={data.planName} />
          <InfoTile label="Team" value={seatSummary(seats)} />
        </div>

        {seats.overLimit && (
          <p
            className="mt-4 rounded-md p-3"
            style={{
              backgroundColor: "var(--state-warning-bg)",
              color: "var(--state-warning)",
              fontSize: 13,
            }}
          >
            This workspace has {seats.used} people but the {data.planName} plan allows{" "}
            {seats.limit}. Nobody has been removed and no data has been deleted, but you cannot add
            anyone else until the team is smaller than the allowance or the plan is upgraded.
          </p>
        )}

        <p className="mt-4" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {WORKSPACE_LIMIT_MESSAGE} Every current plan (Free, Basic and Pro) includes exactly one
          workspace, so upgrading does not add more.
        </p>

        {canRename && (
          <form
            className="mt-5 flex max-w-md flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              renameWorkspace.mutate(workspaceName.trim(), {
                onSuccess: () => toast.success("Workspace updated"),
                onError: (error: Error) => toast.error(error.message),
              });
            }}
          >
            <Field label="Workspace name">
              <input
                style={fieldStyle}
                value={workspaceName}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <button
              type="submit"
              disabled={renameWorkspace.isPending}
              className="synkra-focus h-11 w-fit rounded-md px-5"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {renameWorkspace.isPending ? "Saving…" : "Save workspace"}
            </button>
          </form>
        )}
      </SettingsSection>

      <SettingsSection title="Team">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {seatSummary(seats)}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {activeMembers.length} active · {pending.length} pending ·{" "}
              {seats.available} available
            </div>
          </div>
        </div>

        {canInvite && seats.available > 0 && (
          <form
            className="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              invite.mutate(
                { email: inviteEmail.trim(), role: inviteRole },
                {
                  onSuccess: () => {
                    setInviteEmail("");
                    toast.success("Invitation created");
                  },
                  onError: (error: Error) => toast.error(error.message),
                },
              );
            }}
          >
            <div className="min-w-[240px] flex-1">
              <Field label="Email">
                <input
                  style={fieldStyle}
                  type="email"
                  required
                  value={inviteEmail}
                  placeholder="teammate@company.co.za"
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </Field>
            </div>
            <div className="w-[160px]">
              <Field label="Role">
                <select
                  style={fieldStyle}
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as AssignableRole)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
            </div>
            <button
              type="submit"
              disabled={invite.isPending}
              className="synkra-focus h-11 rounded-md px-5"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "var(--bg-base)",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {invite.isPending ? "Inviting…" : "Invite member"}
            </button>
          </form>
        )}

        {canInvite && seats.available <= 0 && (
          <p
            className="mt-5 rounded-md p-3"
            style={{
              backgroundColor: "var(--state-warning-bg)",
              color: "var(--state-warning)",
              fontSize: 13,
            }}
          >
            Your workspace has reached the {seats.limit}-seat limit for the {data.planName} plan.
            {seats.tier === "pro"
              ? " Remove a member or cancel a pending invitation to free a seat."
              : " Remove a member, cancel a pending invitation, or upgrade your plan for more seats."}
          </p>
        )}

        {!canInvite && (
          <p className="mt-5" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Only the workspace owner and admins can invite team members.
          </p>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full" style={{ fontSize: 14, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "left" }}>
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Joined</th>
                {canManageTeam && <th className="pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((member) => (
                <tr key={member.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td className="py-3 pr-4">
                    <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {member.name || member.email || "Team member"}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{member.email}</div>
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {roleLabel(member.role)}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill label="Active" tone="ok" />
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(member.joinedAt)}
                  </td>
                  {canManageTeam && (
                    <td className="py-3">
                      {member.role === "owner" ? (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Protected</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {can(role, "team.role.change") && (
                            <select
                              aria-label={`Role for ${member.email}`}
                              style={{ ...fieldStyle, height: 34, width: 120, fontSize: 13 }}
                              value={member.role}
                              onChange={(event) =>
                                changeRole.mutate(
                                  {
                                    memberId: member.id,
                                    role: event.target.value as AssignableRole,
                                  },
                                  {
                                    onSuccess: () => toast.success("Role updated"),
                                    onError: (error: Error) => toast.error(error.message),
                                  },
                                )
                              }
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                          {can(role, "team.remove") && (
                            <button
                              type="button"
                              className="synkra-focus rounded-sm"
                              style={{ fontSize: 13, color: "var(--state-error)" }}
                              onClick={() =>
                                removeMember.mutate(member.id, {
                                  onSuccess: () => toast.success("Member removed"),
                                  onError: (error: Error) => toast.error(error.message),
                                })
                              }
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {pending.map((invitation) => (
                <tr key={invitation.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                  <td className="py-3 pr-4">
                    <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {invitation.email}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      Expires {formatDate(invitation.expiresAt)}
                    </div>
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {roleLabel(invitation.role)}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill label="Pending" tone="warn" />
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-secondary)" }}>
                    —
                  </td>
                  {canManageTeam && (
                    <td className="py-3">
                      {canInvite && (
                        <button
                          type="button"
                          className="synkra-focus rounded-sm"
                          style={{ fontSize: 13, color: "var(--state-error)" }}
                          onClick={() =>
                            cancelInvite.mutate(invitation.id, {
                              onSuccess: () => toast.success("Invitation cancelled"),
                              onError: (error: Error) => toast.error(error.message),
                            })
                          }
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {Array.from({ length: seats.available }).map((_, index) => (
                <tr
                  key={`available-${index}`}
                  style={{ borderTop: "1px solid var(--border-default)" }}
                >
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    Available seat
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    —
                  </td>
                  <td className="py-3 pr-4">
                    <Pill label="Open" tone="muted" />
                  </td>
                  <td className="py-3 pr-4" style={{ color: "var(--text-muted)" }}>
                    —
                  </td>
                  {canManageTeam && <td className="py-3" />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
}
