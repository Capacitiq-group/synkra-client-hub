// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/reset-password_/confirm")({
  head: () => ({
    meta: [
      { title: "Reset link required — Synkra Client Portal" },
      { name: "description", content: "A valid password reset link is required to continue." },
      { property: "og:title", content: "Reset link required — Synkra Client Portal" },
      {
        property: "og:description",
        content: "A valid password reset link is required to continue.",
      },
    ],
  }),
  component: ConfirmLayout,
});

function ConfirmLayout() {
  const matches = useMatches();
  const hasToken = matches.some((m) => m.routeId === "/reset-password_/confirm/$token");
  if (hasToken) return <Outlet />;

  return (
    <div
      className="flex min-h-screen justify-center px-6 py-24 text-left"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Link
          to="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--accent-green)",
          }}
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
        <h1 style={{ marginTop: 40, fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>
          This link is incomplete
        </h1>
        <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)" }}>
          We could not find a reset token in this address. Reset links expire after one hour, so
          request a fresh one and use the newest email.
        </p>
        <Link
          to="/reset-password"
          className="transition-opacity hover:opacity-90"
          style={{
            marginTop: 24,
            width: "100%",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--accent-green)",
            color: "#0A0A0A",
            fontWeight: 600,
            fontSize: 15,
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
          }}
        >
          Request a new reset link
        </Link>
      </div>
    </div>
  );
}
