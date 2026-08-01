import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Help — Synkra Client Portal" },
      { name: "description", content: "Guides and support for the Synkra client portal." },
      { property: "og:title", content: "Help — Synkra Client Portal" },
      { property: "og:description", content: "Guides and support for the Synkra client portal." },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>Help</h1>
      <p style={{ marginTop: 12, fontSize: 15, color: "var(--text-secondary)", maxWidth: 520 }}>
        Guides, answers and support for your Synkra portal. Email hello@synkra.co.za if you need a
        hand with anything.
      </p>

      <button
        type="button"
        onClick={() => navigate({ to: "/dashboard", search: { onboarding: true } })}
        className="mt-8 flex items-center gap-3 rounded-md border px-4 transition-colors"
        style={{
          height: 48,
          borderColor: "var(--border-default)",
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: 15,
        }}
      >
        <RotateCcw size={16} style={{ color: "var(--accent-green)" }} />
        Restart setup guide
      </button>
    </div>
  );
}
