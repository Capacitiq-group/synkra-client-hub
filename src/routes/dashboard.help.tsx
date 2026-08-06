import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Mail, PlayCircle } from "lucide-react";
import { DiagnosticsPanel } from "@/components/portal/diagnostics-panel";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Help — Synkra Client Portal" },
      {
        name: "description",
        content: "Guides, answers and support for using Synkra automations.",
      },
      { property: "og:title", content: "Help — Synkra Client Portal" },
      {
        property: "og:description",
        content: "Guides, answers and support for using Synkra automations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const VIDEOS = [
  [
    "Activating your first template",
    "A 3-minute walkthrough of choosing a pre-built automation and seeing it run.",
    import.meta.env["VITE_LOOM_VIDEO_TEMPLATES"],
  ],
  [
    "Building a workflow from scratch",
    "How to use the builder to create a custom automation for your business.",
    import.meta.env["VITE_LOOM_VIDEO_BUILDER"],
  ],
  [
    "Reading your activity logs",
    "How to check if automations are running and fix anything that goes wrong.",
    import.meta.env["VITE_LOOM_VIDEO_LOGS"],
  ],
] as const;

const FAQ = [
  [
    "How do I activate a workflow template?",
    "Go to Workflows and open the Templates tab. Click Activate on any template. This opens the builder with the template pre-loaded. Review each step, fill in any required fields, and click Publish. Your workflow goes live immediately.",
  ],
  [
    "Why does my workflow show as failed?",
    "A failed run means one step encountered an error. Go to Activity, find the run, and click View to see which step failed and the exact error message. Common causes are missing required data from the trigger or a service connection that needs to be refreshed in Settings.",
  ],
  [
    "Can I edit a workflow after publishing?",
    "Yes. Go to My Workflows, click Edit on any workflow, make your changes, and click Publish again. The updated version replaces the previous one immediately.",
  ],
  [
    "How do I test a workflow without sending real emails?",
    "In the builder click Test in the top bar. Enter sample trigger data and run the test. No emails are sent during test runs. You see exactly what would happen at each step.",
  ],
  [
    "What happens when my email credits run out?",
    "Email automations pause automatically. You receive a warning at 20 percent remaining. When your trial ends in September paid plans launch with higher limits and top-up options. You will receive an email before your trial ends.",
  ],
  [
    "How do I connect Google Calendar or Sheets?",
    "Go to Settings and open the Integrations tab. Click Connect next to the service. You will be asked to sign in with your Google account and authorise access. Once connected your workflows can create events and update spreadsheets.",
  ],
  [
    "Can I build my own automation from scratch?",
    "Yes. Go to Workflows and click Build from scratch. Add a trigger block first then add action blocks below it. Configure each block in the right panel. Test and publish when ready.",
  ],
  [
    "How do I get support?",
    "Email hello@synkra.co.za with your account email and a description of the issue. We respond on South African business days. Your Activity page shows the exact error message for any failed run which often has what you need to fix it yourself.",
  ],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>
      <div className="mt-3 border-t pt-5" style={{ borderColor: "var(--border-default)" }}>
        {children}
      </div>
    </section>
  );
}

function VideoCard({ title, description, url }: { title: string; description: string; url?: string }) {
  const [hover, setHover] = useState(false);
  const thumb = (
    <div
      className="flex aspect-video flex-col items-center justify-center gap-1"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      <PlayCircle
        size={44}
        style={{ color: url && hover ? "var(--accent-green)" : "var(--text-muted)", transition: "color 150ms ease" }}
      />
      {!url && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Coming soon</span>
      )}
    </div>
  );
  return (
    <article
      className="overflow-hidden border"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Watch ${title}`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="block"
        >
          {thumb}
        </a>
      ) : (
        thumb
      )}
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        <p className="mt-1.5" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
    </article>
  );
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const height = open ? (bodyRef.current?.scrollHeight ?? 400) : 0;
  return (
    <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{question}</span>
        <ChevronDown
          size={18}
          className="shrink-0"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: reduced ? "none" : "transform 200ms ease",
          }}
        />
      </button>
      <div
        style={{
          height: open ? height : 0,
          overflow: "hidden",
          transition: reduced ? "none" : "height 200ms ease",
        }}
      >
        <div ref={bodyRef}>
          <p className="pb-4 text-sm leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

function HelpPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10">
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>Help</h1>
      <p className="mt-2" style={{ fontSize: 15, color: "var(--text-secondary)" }}>
        Everything you need to get started and get the most from Synkra.
      </p>

      <div className="mt-10 flex flex-col gap-12">
        <Section title="Getting started">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VIDEOS.map(([title, description, url]) => (
              <VideoCard key={title} title={title} description={description} url={url || undefined} />
            ))}
          </div>
        </Section>

        <Section title="Common questions">
          <div>
            {FAQ.map(([question, answer], index) => (
              <FaqItem
                key={question}
                question={question}
                answer={answer}
                open={open === index}
                onToggle={() => setOpen((current) => (current === index ? null : index))}
              />
            ))}
          </div>
        </Section>

        <Section title="Still need help">
          <div
            className="flex gap-4"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
            }}
          >
            <Mail size={24} className="shrink-0" style={{ color: "var(--accent-green)" }} />
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                Email support
              </h3>
              <p className="mt-1.5" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Monday to Friday, 8am to 5pm South African time.
              </p>
              <a
                className="mt-2 inline-block"
                style={{ fontSize: 15, fontWeight: 500, color: "var(--accent-green)" }}
                href="mailto:hello@synkra.co.za"
              >
                hello@synkra.co.za
              </a>
            </div>
          </div>
        </Section>

        <Section title="Diagnostics">
          <DiagnosticsPanel />
        </Section>

        <div
          className="flex flex-wrap gap-2 border-t pt-6"
          style={{ borderColor: "var(--border-default)", fontSize: 14, color: "var(--text-muted)" }}
        >
          <span>Want to revisit the setup guide?</span>
          <button
            type="button"
            style={{ color: "var(--accent-green)" }}
            onClick={() => navigate({ to: "/dashboard", search: { onboarding: true } })}
          >
            Restart the guide
          </button>
        </div>
      </div>
    </div>
  );
}
