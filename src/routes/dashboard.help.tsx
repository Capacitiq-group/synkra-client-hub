import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Mail, PlayCircle, Search } from "lucide-react";
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

const FAQ_CATEGORIES = [
  "Getting Started",
  "Workflows & Templates",
  "Webhooks & Triggers",
  "Activity & Troubleshooting",
  "Account & Settings",
  "Billing & Credits",
] as const;

const FAQ: { question: string; answer: string; category: (typeof FAQ_CATEGORIES)[number] }[] = [
  {
    question: "How do I activate a workflow template?",
    answer: "Go to Workflows and open the Templates tab. Click Activate on any template. This opens the builder with the template pre-loaded. Review each step, fill in any required fields, and click Publish. Your workflow goes live immediately.",
    category: "Workflows & Templates",
  },
  {
    question: "Why does my workflow show as failed?",
    answer: "A failed run means one step encountered an error. Go to Activity, find the run, and click View to see which step failed and the exact error message. Common causes are missing required data from the trigger or a service connection that needs to be refreshed in Settings.",
    category: "Activity & Troubleshooting",
  },
  {
    question: "Can I edit a workflow after publishing?",
    answer: "Yes. Go to My Workflows, click Edit on any workflow, make your changes, and click Publish again. The updated version replaces the previous one immediately.",
    category: "Workflows & Templates",
  },
  {
    question: "How do I test a workflow without sending real emails?",
    answer: "In the builder click Test in the top bar. Enter sample trigger data and run the test. No emails are sent during test runs. You see exactly what would happen at each step.",
    category: "Workflows & Templates",
  },
  {
    question: "What happens when my email credits run out?",
    answer: "Email automations pause automatically. You receive a warning at 20 percent remaining. When your trial ends in September paid plans launch with higher limits and top-up options. You will receive an email before your trial ends.",
    category: "Billing & Credits",
  },
  {
    question: "How do I connect Google Calendar or Sheets?",
    answer: "Integrations require a paid plan — upgrade to connect. On a paid plan, go to Settings and open the Integrations tab, then click Connect next to the service. You will be asked to sign in and authorise access. There is no limit on how many platforms a paid plan can connect. Free accounts keep every other free feature, but cannot connect external platforms.",
    category: "Account & Settings",
  },
  {
    question: "Can I build my own automation from scratch?",
    answer: "Yes. Go to Workflows and click Build from scratch. Add a trigger block first then add action blocks below it. Configure each block in the right panel. Test and publish when ready.",
    category: "Getting Started",
  },
  {
    question: "How do I get support?",
    answer: "Email hello@synkra.co.za with your account email and a description of the issue. We respond on South African business days. Your Activity page shows the exact error message for any failed run which often has what you need to fix it yourself.",
    category: "Getting Started",
  },
  {
    question: "What is a webhook and how do I get my form to send data to Synkra?",
    answer: "A webhook is a URL that receives data when something happens in another system. When you activate a webhook trigger Synkra gives you a unique URL. You paste that URL into your form builder as the destination for form submissions. When someone submits your form the data is sent to Synkra and your workflow runs automatically. Most form builders including Typeform, Tally, and Google Forms support webhook destinations.",
    category: "Webhooks & Triggers",
  },
  {
    question: "My form field is called full_name but the template uses {{payload.name}}. Will it work?",
    answer: "No. The variable name must match the field name your form sends exactly. If your form sends full_name you must use {{payload.full_name}} in your workflow actions. Edit the action block and update the variable to match your form's field names. You can see what your form sends by adding your webhook URL to your form, submitting a test entry, and checking the Activity page for the incoming payload.",
    category: "Webhooks & Triggers",
  },
  {
    question: "What does {{payload.name}} mean?",
    answer: "It is a variable that gets replaced with real data when your workflow runs. If someone submits a form with the name Sarah Jones then {{payload.name}} becomes Sarah Jones everywhere it appears in your workflow. Variables use double curly braces and refer to fields from the trigger data or from earlier blocks in the workflow.",
    category: "Webhooks & Triggers",
  },
  {
    question: "Where do I see what data is coming into my webhook?",
    answer: "Go to Activity and click on any successful run. The Trigger input section shows exactly what data was received. This is how you confirm what field names your form is sending.",
    category: "Activity & Troubleshooting",
  },
  {
    question: "What does a scheduled workflow use as its data if there is no form submission?",
    answer: "Scheduled workflows do not receive external data. They use your account information and anything stored in your saved collections. Use a Find information block to look up records before sending an email. For example find all leads added in the last 24 hours then include the count in your email body.",
    category: "Webhooks & Triggers",
  },
  {
    question: "Can I send emails to multiple people from one workflow?",
    answer: "Not with a single Send email block. The Send email block sends to one recipient per run. To email multiple people you need either separate workflows for each person or a scheduled workflow that loops through a list. A proper loop block for list processing is coming in a future update.",
    category: "Workflows & Templates",
  },
  {
    question: "What happens if a workflow fails halfway through?",
    answer: "The steps completed before the failure are not reversed. If step 1 saved a record and step 2 failed the record still exists. The failed run appears in Activity with a red status. You can click View to see exactly which step failed and why. You can then click Retry to run the workflow again from the beginning.",
    category: "Activity & Troubleshooting",
  },
  {
    question: "How do I know if an email was actually sent?",
    answer: "Go to Activity and open the run. The Send email step shows Success if the email was submitted to our sending service. Whether it was delivered to the inbox depends on the recipient's email provider. If you are testing use your own email address as the recipient.",
    category: "Activity & Troubleshooting",
  },
  {
    question: "What is the difference between draft and published?",
    answer: "A draft workflow is saved but not running. It does not respond to triggers and does not run on schedule. A published workflow is live and runs every time its trigger fires. You can switch between draft and published at any time.",
    category: "Workflows & Templates",
  },
  {
    question: "Can I duplicate a workflow?",
    answer: "Yes. Go to My Workflows, click the three-dot menu on any workflow card, and select Duplicate. A copy is created as a draft with a new name.",
    category: "Workflows & Templates",
  },
  {
    question: "What is a collection and why do I need to know this?",
    answer: "A collection is where Synkra stores your data. It is like a spreadsheet tab with rows and columns. The Save information and Find information blocks let your workflows read from and write to these collections. For basic email automations you do not need to know about collections at all. They become relevant when you want to store lead information, look up customer records, or build more complex automations.",
    category: "Getting Started",
  },
  {
    question: "How do I connect my website form to Synkra?",
    answer: "Copy the webhook URL from the webhook trigger block in your workflow. In your form builder find the webhook or custom integration settings and paste that URL. Most form builders call this a webhook, custom destination, or integration URL. When your form is submitted the data goes to Synkra and your workflow starts.",
    category: "Webhooks & Triggers",
  },
  {
    question: "Can I use Synkra without a website?",
    answer: "Yes. You can trigger workflows manually using the Test button in the builder, set up scheduled workflows that run automatically without any external trigger, or use Synkra with any tool that can send a webhook including Typeform, Tally, and Google Forms which are free tools that do not require a website.",
    category: "Getting Started",
  },
  {
    question: "Why is the {{variable}} in my email showing as blank?",
    answer: "The variable name does not match the field name in the incoming data. Check the Activity page and open the trigger input for a recent run to see the exact field names being sent. Update the variable in your action block to match.",
    category: "Activity & Troubleshooting",
  },
  {
    question: "How many workflows can I have active at once?",
    answer: "During your free trial you can have unlimited workflows. Your only limit is 2000 total workflow runs per month and 100 emails per month.",
    category: "Billing & Credits",
  },
  {
    question: "What is a workflow run?",
    answer: "One run is one complete execution of your workflow from trigger to finish. If your lead notification workflow fires 50 times in a month because 50 people submitted your form that counts as 50 runs.",
    category: "Billing & Credits",
  },
  {
    question: "Can I use Synkra to send automated WhatsApp messages?",
    answer: "Not yet. WhatsApp automation is coming in September 2026 when we launch our full platform. Your current free trial includes email automation only.",
    category: "Getting Started",
  },
  {
    question: "How do I cancel or pause a workflow?",
    answer: "Go to My Workflows and click Pause on any active workflow. The workflow stops responding to triggers immediately. Click Resume to reactivate it. Pausing does not delete any data or configuration.",
    category: "Workflows & Templates",
  },
  {
    question: "What does the Wait block do and when should I use it?",
    answer: "The Wait block pauses the workflow for a set time before continuing. For example in a review request workflow you might wait 24 hours after a job is completed before sending the review request email. Without the Wait block the email would send instantly. Use Wait whenever there should be a delay between a trigger and an action.",
    category: "Workflows & Templates",
  },
  {
    question: "Is my customer data safe?",
    answer: "Your data is stored on a private server. We do not sell or share your customer data with any third parties. You can request deletion of your data at any time by emailing hello@synkra.co.za.",
    category: "Account & Settings",
  },
  {
    question: "How does mailbox monitoring actually work?",
    answer:
      'Every account gets a dedicated inbound address (shown on the "Email received" trigger in the builder). Forward emails to it from Gmail or Outlook using a filter or forwarding rule. The first time you set this up, your email provider asks you to confirm the forwarding address — we detect and confirm this automatically when possible. Anything forwarded there is checked against the trigger\'s criteria.',
    category: "Webhooks & Triggers",
  },
  {
    question: "Why is my Email received workflow replying to everything, including newsletters?",
    answer:
      'If the trigger is set to "Run this workflow for every forwarded email", it runs on everything forwarded to your inbound address — including newsletters and notifications. Open the trigger\'s settings, choose "Only when", and set a condition (for example subject contains "quote") so it only responds to emails that actually match.',
    category: "Webhooks & Triggers",
  },
  {
    question: "What are variables like {{payload.name}} and how do I use them?",
    answer:
      'Variables let you insert real data into your emails automatically. Where they come from depends on the trigger: for a Webhook trigger, they come from whatever field names you list under "What information will this receive?" — typing name, email there gives you {{payload.name}} and {{payload.email}}. For an Email received trigger, you automatically get {{trigger.from_email}}, {{trigger.from_name}}, {{trigger.subject}}, and {{trigger.body}} — the sender\'s details and message content. You can type these directly into any To, Subject, or Body field.',
    category: "Workflows & Templates",
  },
  {
    question: "The Insert variable button doesn't show the variable I need — what do I do?",
    answer:
      "Some variables (like the ones from an Email received trigger) aren't in the Insert variable picker yet. You can still type them manually — for example type {{trigger.from_email}} directly into the To field and it will work exactly the same as a picked variable.",
    category: "Workflows & Templates",
  },
  {
    question: "Where do I find my workflow's webhook URL?",
    answer:
      "Open your workflow in the builder, select the Webhook trigger block, and the URL is shown at the top of its settings panel with a copy button. You need to save the workflow at least once before the URL appears.",
    category: "Webhooks & Triggers",
  },
  {
    question: "Do I need to connect Gmail for email triggers?",
    answer:
      "No. Email triggers work by forwarding: you set a forwarding rule or filter in Gmail or Outlook that sends mail to your dedicated inbound address. There is no account to connect, and changing your forwarding rules doesn't require rebuilding your published workflows.",
    category: "Account & Settings",
  },
];


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

function VideoCard({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url?: string;
}) {
  const [hover, setHover] = useState(false);
  const thumb = (
    <div
      className="flex aspect-video flex-col items-center justify-center gap-1"
      style={{ backgroundColor: "var(--bg-elevated)" }}
    >
      <PlayCircle
        size={44}
        style={{
          color: url && hover ? "var(--accent-green)" : "var(--text-muted)",
          transition: "color 150ms ease",
        }}
      />
      {!url && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Coming soon</span>}
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
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
          {question}
        </span>
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

function FaqFilterButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="synkra-focus shrink-0 transition-colors"
      style={{
        backgroundColor: selected ? "var(--accent-green-subtle)" : "transparent",
        border: `1px solid ${selected ? "var(--accent-green-border)" : "var(--border-default)"}`,
        color: selected ? "var(--accent-green)" : "var(--text-muted)",
        borderRadius: "var(--radius-full)",
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

function HelpPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [faqQuery, setFaqQuery] = useState("");
  const [faqCategory, setFaqCategory] = useState<string>("All");

  const term = faqQuery.trim().toLowerCase();
  const visibleFaq = FAQ.filter((entry) => {
    const matchesCategory = faqCategory === "All" || entry.category === faqCategory;
    const matchesTerm =
      term === "" ||
      entry.question.toLowerCase().includes(term) ||
      entry.answer.toLowerCase().includes(term);
    return matchesCategory && matchesTerm;
  });
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
              <VideoCard
                key={title}
                title={title}
                description={description}
                url={url || undefined}
              />
            ))}
          </div>
        </Section>

        <Section title="Common questions">
          <div className="relative mb-4">
            <Search
              size={16}
              aria-hidden="true"
              style={{ color: "var(--text-muted)", position: "absolute", left: 12, top: 12 }}
            />
            <input
              type="search"
              value={faqQuery}
              onChange={(e) => setFaqQuery(e.target.value)}
              placeholder="Search help articles"
              aria-label="Search help articles"
              className="synkra-focus w-full md:w-80"
              style={{
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                height: 40,
                padding: "0 12px 0 34px",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            />
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {["All", ...FAQ_CATEGORIES].map((category) => (
              <FaqFilterButton
                key={category}
                label={category}
                selected={faqCategory === category}
                onClick={() => setFaqCategory(category)}
              />
            ))}
          </div>

          <div>
            {visibleFaq.length === 0 ? (
              <p className="py-4" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                No results for &ldquo;{faqQuery.trim()}&rdquo;. Try a different search or browse by
                topic below.
              </p>
            ) : (
              visibleFaq.map((entry) => (
                <FaqItem
                  key={entry.question}
                  question={entry.question}
                  answer={entry.answer}
                  open={open === entry.question}
                  onToggle={() =>
                    setOpen((current) => (current === entry.question ? null : entry.question))
                  }
                />
              ))
            )}
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
