// INTERNAL PAGE — deliberately not linked from any customer-facing navigation.
// First slice of a future internal admin area; today it only manages ghost
// mailboxes. Access requires a signed-in session (no role system yet).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";
import {
  GHOST_MAILBOX_DOMAIN,
  createGhostMailbox,
  deleteGhostMailbox,
  listGhostMailboxes,
  sendFromGhostMailbox,
  type GhostMailbox,
} from "@/lib/admin/ghost-mailboxes";
import { fieldStyle } from "@/components/settings/settings-primitives";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Internal admin — Synkra" },
      { name: "description", content: "Internal Synkra admin tools." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Internal admin — Synkra" },
      { property: "og:description", content: "Internal Synkra admin tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mailboxAddress(mailbox: GhostMailbox): string {
  if (mailbox.address) return mailbox.address;
  if (mailbox.local_part) return `${mailbox.local_part}@${GHOST_MAILBOX_DOMAIN}`;
  return mailbox.id;
}

function AdminPage() {
  const navigate = useNavigate();
  const isReady = useAuthStore((s) => s.isReady);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (isReady && !user) navigate({ to: "/login", replace: true });
  }, [isReady, user, navigate]);

  if (!isReady || !user) return null;

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-10"
      style={{ color: "var(--text-primary)" }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Internal admin</h1>
      <p className="mt-1" style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Ghost mailboxes for {user.email}. Internal tool — not linked from the portal.
      </p>
      <GhostMailboxPanel />
    </main>
  );
}

function GhostMailboxPanel() {
  const queryClient = useQueryClient();
  const [localPart, setLocalPart] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [composeFor, setComposeFor] = useState<GhostMailbox | null>(null);

  const mailboxes = useQuery({
    queryKey: ["ghost-mailboxes"],
    queryFn: listGhostMailboxes,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ghost-mailboxes"] });

  const create = useMutation({
    mutationFn: createGhostMailbox,
    onSuccess: async () => {
      setLocalPart("");
      setForwardTo("");
      toast.success("Mailbox created");
      await invalidate();
    },
    onError: (err) => toast.error(`Could not create mailbox: ${errorMessage(err)}`),
  });

  const remove = useMutation({
    mutationFn: deleteGhostMailbox,
    onSuccess: async () => {
      toast.success("Mailbox deleted");
      await invalidate();
    },
    onError: (err) => toast.error(`Could not delete mailbox: ${errorMessage(err)}`),
  });

  const cleanLocalPart = localPart.trim().toLowerCase();

  return (
    <section
      className="mt-6 border p-5"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Ghost mailboxes</h2>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!cleanLocalPart || !forwardTo.trim()) return;
          create.mutate({ localPart: cleanLocalPart, forwardTo });
        }}
      >
        <label className="flex-1">
          <span
            className="mb-1.5 block"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
          >
            Local part
          </span>
          <input
            value={localPart}
            onChange={(event) => setLocalPart(event.target.value)}
            placeholder="hello"
            required
            style={fieldStyle}
          />
          <span className="mt-1.5 block" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {cleanLocalPart ? `${cleanLocalPart}@${GHOST_MAILBOX_DOMAIN}` : `…@${GHOST_MAILBOX_DOMAIN}`}
          </span>
        </label>
        <label className="flex-1">
          <span
            className="mb-1.5 block"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}
          >
            Forward to
          </span>
          <input
            type="email"
            value={forwardTo}
            onChange={(event) => setForwardTo(event.target.value)}
            placeholder="someone@example.com"
            required
            style={fieldStyle}
          />
        </label>
        <Button type="submit" disabled={create.isPending} className="sm:mb-6">
          {create.isPending ? "Adding…" : "Add mailbox"}
        </Button>
      </form>

      <div className="mt-6">
        {mailboxes.isLoading && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading mailboxes…</p>
        )}
        {mailboxes.isError && (
          <p style={{ fontSize: 13, color: "var(--state-error)" }}>
            Could not load mailboxes: {errorMessage(mailboxes.error)}
          </p>
        )}
        {mailboxes.data?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No mailboxes yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {(mailboxes.data ?? []).map((mailbox) => (
            <li
              key={mailbox.id}
              className="flex flex-col gap-2 border p-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                borderColor: "var(--border-default)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div className="min-w-0">
                <p style={{ fontSize: 14 }}>{mailboxAddress(mailbox)}</p>
                {mailbox.forward_to && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Forwards to {mailbox.forward_to}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="sm" onClick={() => setComposeFor(mailbox)}>
                  Compose
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ color: "var(--state-error)" }}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(mailbox.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {composeFor && (
        <ComposeForm mailbox={composeFor} onClose={() => setComposeFor(null)} />
      )}
    </section>
  );
}

function ComposeForm({ mailbox, onClose }: { mailbox: GhostMailbox; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: sendFromGhostMailbox,
    onSuccess: () => {
      toast.success("Message sent");
      onClose();
    },
    onError: (err) => toast.error(`Could not send: ${errorMessage(err)}`),
  });

  return (
    <form
      className="mt-6 flex flex-col gap-3 border-t pt-5"
      style={{ borderColor: "var(--border-default)" }}
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate({
          mailboxId: mailbox.id,
          from: mailboxAddress(mailbox),
          to,
          subject,
          body,
        });
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600 }}>Compose from {mailboxAddress(mailbox)}</p>
      <input
        type="email"
        value={to}
        onChange={(event) => setTo(event.target.value)}
        placeholder="To"
        required
        style={fieldStyle}
      />
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Subject"
        required
        style={fieldStyle}
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Message"
        required
        rows={6}
        style={{ ...fieldStyle, height: "auto", padding: 14 }}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={send.isPending}>
          {send.isPending ? "Sending…" : "Send"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
