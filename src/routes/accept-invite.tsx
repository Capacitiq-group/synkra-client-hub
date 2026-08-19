/**
 * Landing page for a workspace invitation email.
 *
 * The invitation token arrives as a query parameter. Nothing is trusted here:
 * the token is handed to the existing `acceptInvitationFn` server function,
 * which re-verifies the caller's PocketBase session, matches the invited email
 * against the signed-in account, re-checks expiry and re-checks seat
 * availability before the membership row is written.
 */
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import pb from "@/lib/pocketbase";
import { useAuth } from "@/contexts/AuthContext";
import { acceptInvitationFn, getWorkspaceOverviewFn } from "@/lib/team/team.functions";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const token = String(search["token"] ?? "");
    return token.length >= 8 ? { token } : {};
  },
  head: () => ({
    meta: [
      { title: "Accept invitation — Synkra Client Portal" },
      {
        name: "description",
        content: "Accept your invitation to collaborate in a Synkra workspace.",
      },
      { property: "og:title", content: "Accept invitation — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Accept your invitation to collaborate in a Synkra workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvitePage,
});

type AcceptResult = { ok: true; workspaceId: string } | { ok: false; error: string; message: string };
type OverviewResult =
  | { ok: true; workspace: { id: string; name: string } | null }
  | { ok: false; error: string; message: string };

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[560px] p-6 md:p-12">
      <div
        className="rounded-xl p-8 text-center"
        style={{ border: "1px solid var(--border-default)", backgroundColor: "var(--bg-surface)" }}
      >
        {children}
      </div>
    </main>
  );
}

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { user, isLoading } = useAuth();

  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (isLoading || !user || !token) return;
    const authToken = pb.authStore.token;
    if (!authToken) return;

    attempted.current = true;
    setStatus("working");

    void (async () => {
      try {
        const result = (await acceptInvitationFn({
          data: { token: authToken, token2: token },
        })) as unknown as AcceptResult;

        if (!result.ok) {
          setMessage(result.message);
          setStatus("error");
          return;
        }

        // Best-effort: name the workspace they just joined.
        try {
          const overview = (await getWorkspaceOverviewFn({
            data: { token: authToken },
          })) as unknown as OverviewResult;
          if (overview.ok && overview.workspace) setWorkspaceName(overview.workspace.name);
        } catch {
          /* the success state reads fine without the name */
        }
        setStatus("done");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Could not accept this invitation.");
        setStatus("error");
      }
    })();
  }, [isLoading, user, token]);

  if (!token) {
    return (
      <Panel>
        <MailWarning size={28} style={{ color: "var(--state-error)", margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">Invitation link incomplete</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          This link is missing its invitation token. Open the link in your invitation email again,
          or ask the person who invited you to send a new one.
        </p>
      </Panel>
    );
  }

  if (isLoading) {
    return (
      <Panel>
        <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto" }} />
      </Panel>
    );
  }

  if (!user) {
    const next = `/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <Panel>
        <h1 className="text-[22px] font-bold">Sign in to accept this invitation</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Sign in with the email address the invitation was sent to, and we'll add you to the
          workspace straight away.
        </p>
        <Link
          to="/login"
          search={{ next }}
          className="synkra-focus mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5"
          style={{
            backgroundColor: "var(--accent-green)",
            color: "var(--bg-base)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Sign in
        </Link>
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Don't have an account yet?{" "}
          <Link to="/sign-up" className="underline">
            Create one
          </Link>{" "}
          with the invited email address, then open this link again.
        </p>
      </Panel>
    );
  }

  if (status === "error") {
    return (
      <Panel>
        <MailWarning size={28} style={{ color: "var(--state-error)", margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">We couldn't accept this invitation</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }} role="alert">
          {message ?? "This invitation is not valid."}
        </p>
        <Link to="/dashboard" className="mt-6 inline-block text-[14px] underline">
          Go to my dashboard
        </Link>
      </Panel>
    );
  }

  if (status === "done") {
    return (
      <Panel>
        <CheckCircle2 size={28} style={{ color: "var(--accent-green)", margin: "0 auto" }} />
        <h1 className="mt-4 text-[22px] font-bold">
          You've joined {workspaceName ?? "the workspace"}
        </h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
          Your access is active. Everything shared with this workspace is now available to you.
        </p>
        <Link
          to="/dashboard"
          className="synkra-focus mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5"
          style={{
            backgroundColor: "var(--accent-green)",
            color: "var(--bg-base)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Open the dashboard
        </Link>
      </Panel>
    );
  }

  return (
    <Panel>
      <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto" }} />
      <p className="mt-4 text-[14px]" style={{ color: "var(--text-secondary)" }}>
        Accepting your invitation…
      </p>
    </Panel>
  );
}
