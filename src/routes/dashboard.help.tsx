import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Mail, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard/help")({
  head: () => ({
    meta: [
      { title: "Help — Synkra Client Portal" },
      { name: "description", content: "Guides, answers and support for using Synkra automations." },
      { property: "og:title", content: "Help — Synkra Client Portal" },
      { property: "og:description", content: "Guides, answers and support for using Synkra automations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const VIDEOS = [
  ["Activating your first template", "A walkthrough of choosing a pre-built template and seeing it run for the first time.", import.meta.env["VITE_LOOM_VIDEO_ACTIVATING_TEMPLATE"]],
  ["Building a workflow from scratch", "How to use the block builder to create a custom automation for your specific business need.", import.meta.env["VITE_LOOM_VIDEO_BUILDING_WORKFLOW"]],
  ["Reading your activity logs", "How to check if your workflows are running correctly and fix anything that goes wrong.", import.meta.env["VITE_LOOM_VIDEO_ACTIVITY_LOGS"]],
] as const;
const FAQ = [
  ["How do I activate a workflow template?", "Go to Workflows and select the Templates tab. Click Activate on any template to open the workflow builder with that template loaded. Review the steps, configure any fields that need your business details, then click Publish. Your workflow goes live immediately."],
  ["Why is my workflow showing as failed?", "A failed workflow means one step encountered an error. Go to Activity, find the failed run, and click View to see which step failed and the exact error message. Common causes are a missing required field in the trigger data or an expired connection to an external service in your Integrations settings."],
  ["Can I edit a workflow after publishing it?", "Yes. Find your workflow on the My Workflows tab, click Edit, make your changes, and click Publish again. The updated version replaces the previous one immediately."],
  ["How do I test a workflow without sending real emails?", "In the workflow builder click Test in the top bar. Provide sample trigger data and run the test. Emails are not sent during test runs. You will see exactly what would happen at each step before going live."],
  ["What happens when my email credits run out?", "Email automations pause automatically. You will receive a warning when you reach 20 percent remaining. When beta ends in September, paid plans with higher sending limits and top-up options launch. You will receive an email before your trial ends with everything you need to continue."],
  ["How do I connect Google Calendar or Google Sheets?", "Go to Settings and open the Integrations tab. Click Connect beside the service you want. You will be asked to authorise Synkra through your Google account. Once connected, your workflows can create events and update spreadsheets automatically."],
  ["Can I build my own automation from scratch?", "Yes. Go to Workflows and click Build from scratch. Start with a trigger that defines what starts the automation, then add action blocks beneath it. Configure each block in the panel on the right, then test and publish."],
  ["How do I get support if something is not working?", "Email hello@synkra.co.za with your account email and a brief description of the issue. We respond on South African business days. You can also check your Activity page for the exact error message from any failed run. This often has everything you need to fix the problem yourself."],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="text-base font-semibold">{title}</h2><div className="mt-3 border-t pt-5" style={{ borderColor: "var(--border-default)" }}>{children}</div></section>;
}

function HelpPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(null);
  return <div className="mx-auto w-full max-w-[1200px] p-4 text-left md:p-10"><h1 style={{ fontSize: 28, fontWeight: 800 }}>Help</h1><p className="mt-2 text-[15px]" style={{ color: "var(--text-secondary)" }}>Resources to help you get the most from Synkra.</p><div className="mt-10 flex flex-col gap-12"><Section title="Getting started"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{VIDEOS.map(([title,description,url]) => <article key={title} className="overflow-hidden border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)", borderRadius: "var(--radius-lg)" }}><a href={url || undefined} target="_blank" rel="noreferrer" className="flex aspect-video flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-elevated)", pointerEvents: url ? "auto" : "none" }} aria-label={url ? `Watch ${title}` : undefined}><PlayCircle size={40} style={{ color: "var(--text-muted)" }} />{!url && <span className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Coming soon</span>}</a><div className="p-4"><h3 className="text-[15px] font-semibold">{title}</h3><p className="mt-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>{description}</p></div></article>)}</div></Section><Section title="Common questions"><div>{FAQ.map(([question,answer], index) => <div key={question} className="border-b" style={{ borderColor: "var(--border-subtle)" }}><button type="button" onClick={() => setOpen((current) => current === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-4 text-left" aria-expanded={open === index}><span className="text-[15px] font-medium">{question}</span><ChevronDown size={18} className="shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: open === index ? "rotate(180deg)" : "none" }} /></button>{open === index && <p className="pb-4 text-sm leading-[1.7]" style={{ color: "var(--text-secondary)" }}>{answer}</p>}</div>)}</div></Section><Section title="Still need help"><div className="border p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)", borderRadius: "var(--radius-lg)" }}><Mail size={24} style={{ color: "var(--accent-green)" }} /><h3 className="mt-4 text-[17px] font-semibold">Email support</h3><p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>We respond on South African business days, Monday to Friday, 8am to 5pm SAST.</p><a className="mt-3 inline-block text-[15px] font-medium" style={{ color: "var(--accent-green)" }} href="mailto:hello@synkra.co.za">hello@synkra.co.za</a></div></Section><div className="flex flex-wrap gap-2 border-t pt-6 text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}><span>Want to see the setup guide again?</span><button type="button" style={{ color: "var(--accent-green)" }} onClick={() => navigate({ to: "/dashboard", search: { onboarding: true } })}>Restart the setup guide</button></div></div></div>;
}
