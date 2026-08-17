// SECURITY: all mutations go through server functions that re-verify the
// caller's token, workspace role and seat availability. Never trust this hook.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptInvitationFn,
  cancelInvitationFn,
  changeMemberRoleFn,
  getWorkspaceOverviewFn,
  inviteMemberFn,
  removeMemberFn,
  renameWorkspaceFn,
} from "@/lib/team/team.functions";
import { createWorkspaceFn } from "@/lib/usage/usage.functions";
import type { AssignableRole } from "@/lib/team/roles";

type Result = Record<string, unknown> & { ok?: boolean; message?: string };

function unwrap(result: Result): Result {
  if (result && result.ok === false) {
    throw new Error(typeof result.message === "string" ? result.message : "Action not allowed.");
  }
  return result;
}

function token(): string {
  const value = pb.authStore.token;
  if (!value) throw new Error("Not authenticated");
  return value;
}

export function useWorkspaceOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workspace-overview", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const result = (await getWorkspaceOverviewFn({
        data: { token: token() },
      })) as unknown as Result;
      return unwrap(result) as unknown as Awaited<
        ReturnType<typeof import("@/lib/team/team.server").getWorkspaceOverview>
      > & { ok: true };
    },
    staleTime: 10000,
  });
}

export function useTeamActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace-overview"] });

  const createWorkspace = useMutation({
    mutationFn: async (name: string) =>
      unwrap((await createWorkspaceFn({ data: { token: token(), name } })) as unknown as Result),
    onSuccess: invalidate,
  });

  const renameWorkspace = useMutation({
    mutationFn: async (name: string) =>
      unwrap((await renameWorkspaceFn({ data: { token: token(), name } })) as unknown as Result),
    onSuccess: invalidate,
  });

  const invite = useMutation({
    mutationFn: async (input: { email: string; role: AssignableRole }) =>
      unwrap(
        (await inviteMemberFn({ data: { token: token(), ...input } })) as unknown as Result,
      ),
    onSuccess: invalidate,
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) =>
      unwrap(
        (await cancelInvitationFn({
          data: { token: token(), invitationId },
        })) as unknown as Result,
      ),
    onSuccess: invalidate,
  });

  const acceptInvite = useMutation({
    mutationFn: async (inviteToken: string) =>
      unwrap(
        (await acceptInvitationFn({
          data: { token: token(), token2: inviteToken },
        })) as unknown as Result,
      ),
    onSuccess: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) =>
      unwrap(
        (await removeMemberFn({ data: { token: token(), memberId } })) as unknown as Result,
      ),
    onSuccess: invalidate,
  });

  const changeRole = useMutation({
    mutationFn: async (input: { memberId: string; role: AssignableRole }) =>
      unwrap(
        (await changeMemberRoleFn({ data: { token: token(), ...input } })) as unknown as Result,
      ),
    onSuccess: invalidate,
  });

  return {
    createWorkspace,
    renameWorkspace,
    invite,
    cancelInvite,
    acceptInvite,
    removeMember,
    changeRole,
  };
}
