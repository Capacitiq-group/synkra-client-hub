import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Plus, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import pb from "@/lib/pocketbase";
import { webhookUrlFor, inboundEmailAddressForUser } from "@/lib/workflow/api";
import { OPERATORS, blockSubtype, definitionFor } from "@/lib/workflow/blocks";
import { useIntegrationsMap } from "@/hooks/useIntegrations";
import { missingScopes, integrationConnected } from "@/lib/workflow/scopes";
import { HubspotConnectButton, HubspotReauthorizeButton } from "@/components/integrations/hubspot-connect";
import { SlackConnectButton } from "@/components/integrations/slack-connect";
import { ZohoConnectButton, ZohoReauthorizeButton } from "@/components/integrations/zoho-connect";
import {
  availableVariableOptions,
  extractFieldEntries,
  humanizeFieldName,
  toFieldKey,
} from "@/lib/workflow/describe";
import type { WorkflowBlock } from "@/lib/workflow/types";
import { PlainField, VariableField, JsonField } from "./variables-popover";
import { SlackChannelPicker } from "./slack-channel-picker";

/** Trigger types whose config is "pick a Slack channel". */
const SLACK_TRIGGERS = ["slack_message_received", "slack_unanswered_check", "slack_daily_digest"];


/** One-tap starting points for the most common things people extract. */
const EXTRACT_PRESETS: { name: string; description: string }[] = [
  {
    name: "Customer intent",
    description: "What the customer is asking for or trying to accomplish.",
  },
  {
    name: "Product interest",
    description: "Which product or service the customer mentions or is interested in.",
  },
  {
    name: "Sentiment",
    description: "Whether the customer's message is positive, negative, or neutral.",
  },
  {
    name: "Contact preference",
    description: "The customer's preferred way or best time to be contacted.",
  },
];

/**
 * Repeatable "what should the AI find?" list for the extract-with-AI block.
 *
 * Stored in the existing `fields` config object as name -> description, which
 * is exactly what the automation engine already reads, so nothing changes
 * behind the scenes.
 */
function rowsFromBlock(block: WorkflowBlock): Array<[string, string]> {
  // Rows the user has not named yet are stored under a `__new_n` placeholder
  // key (an object cannot hold two empty keys); show them as blank.
  return extractFieldEntries(block).map(([name, description]): [string, string] => [
    name.startsWith("__new_") || !name ? "" : humanizeFieldName(name),
    description,
  ]);
}

function ExtractFieldsEditor({
  block,
  onChange,
}: {
  block: WorkflowBlock;
  onChange: (fields: Array<[string, string]>) => void;
}) {
  // Local state so the user can type freely; the stored key is derived from
  // what they typed each time it changes.
  const [rows, setRows] = useState<Array<[string, string]>>(() => rowsFromBlock(block));
  useEffect(() => {
    setRows(rowsFromBlock(block));
    // Re-read only when a different block is selected, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  const commit = (next: Array<[string, string]>) => {
    setRows(next);
    onChange(next);
  };

  const update = (index: number, name: string, description: string) => {
    commit(rows.map((row, i): [string, string] => (i === index ? [name, description] : row)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
          Fields to extract
        </span>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          Give each piece of information a name and tell the AI what to look for.
        </p>
      </div>

      {rows.map(([name, description], index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md p-2"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <PlainField
                label="Field name"
                value={name}
                placeholder="e.g. Customer intent"
                onChange={(v) => update(index, v, description)}
              />
            </div>
            <button
              type="button"
              onClick={() => commit(rows.filter((_, i) => i !== index))}
              aria-label={`Remove field ${name || index + 1}`}
              className="synkra-focus mt-6 rounded-sm"
              style={{ color: "var(--text-muted)", padding: 4 }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <PlainField
            label="What should the AI look for?"
            value={description}
            placeholder="e.g. What the customer is asking for or trying to accomplish."
            onChange={(v) => update(index, name, v)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => commit([...rows, ["", ""]])}
        className="synkra-focus inline-flex w-fit items-center gap-1 rounded-md border"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
          fontSize: 12,
          padding: "6px 10px",
        }}
      >
        <Plus size={12} aria-hidden="true" />
        Add field
      </button>

      <div className="flex flex-col gap-1.5">
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Or start with a common one:</span>
        <div className="flex flex-wrap gap-1.5">
          {EXTRACT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                const existing = rows.findIndex(
                  ([n]) => n.trim().toLowerCase() === preset.name.toLowerCase(),
                );
                if (existing >= 0) {
                  update(existing, preset.name, preset.description);
                  return;
                }
                // Fill an empty row if the user left one behind, else append.
                const blank = rows.findIndex(([n, d]) => !n.trim() && !d.trim());
                const entry: [string, string] = [preset.name, preset.description];
                commit(
                  blank >= 0
                    ? rows.map((row, i) => (i === blank ? entry : row))
                    : [...rows, entry],
                );
              }}
              className="synkra-focus rounded-full border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                fontSize: 12,
                padding: "4px 10px",
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Variables an inbound email trigger can be matched on. */
const EMAIL_TRIGGER_VARIABLES: { value: string; label: string }[] = [
  { value: "trigger.subject", label: "Subject" },
  { value: "trigger.from_email", label: "From address" },
  { value: "trigger.body", label: "Message body" },
];

/**
 * Inbound email setup for the "Email received" trigger.
 *
 * Replaces the old Gmail OAuth connect flow: every account gets one dedicated
 * forwarding address and Resend delivers matching mail to the backend.
 */
function InboundEmailSetup({
  config,
  set,
  replace,
}: {
  config: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  replace: (config: Record<string, unknown>) => void;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const address = user?.id ? inboundEmailAddressForUser(user.id) : null;

  const verification = useQuery({
    queryKey: ["inbound-address", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const records = await pb.collection("inbound_addresses").getFullList({
          filter: pb.filter("user_id = {:userId}", { userId: user.id }),
        });
        const record = records[0];
        return record ? { verified: Boolean(record["verified"]) } : null;
      } catch {
        // The collection may not be readable/available yet — never block setup.
        return null;
      }
    },
    staleTime: 30000,
  });

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const matchAll = config["match_all"] !== false && !config["variable"];
  const operator = String(config["operator"] ?? "contains");

  const chooseMatchAll = () => {
    replace({ channel: "resend_inbound", match_all: true });
  };
  const chooseCriteria = () => {
    replace({
      channel: "resend_inbound",
      variable: String(config["variable"] ?? "trigger.subject"),
      operator: String(config["operator"] ?? "contains"),
      value: String(config["value"] ?? ""),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Your dedicated inbound address
        </span>
        {address ? (
          <>
            <div
              className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
              style={{
                border: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <code style={{ fontSize: 12, color: "var(--text-primary)" }}>{address}</code>
              <button
                type="button"
                onClick={() => void copy()}
                aria-label="Copy inbound email address"
                className="synkra-focus flex items-center gap-1 rounded-sm"
                style={{ fontSize: 12, color: "var(--accent-green)" }}
              >
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Forward emails to this address from Gmail or Outlook using a filter or forwarding
              rule. The first time you set this up, you&apos;ll need to confirm the forwarding
              address with your email provider — we detect and confirm this automatically when
              possible.
            </p>
            {verification.data?.verified ? (
              <p style={{ fontSize: 12, color: "var(--state-success)" }}>
                Verified — forwarded emails will start this workflow.
              </p>
            ) : verification.isSuccess ? (
              <p style={{ fontSize: 12, color: "var(--state-warning)" }}>
                Not verified yet — send a test forwarded email to complete setup.
              </p>
            ) : null}
          </>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Sign in to see your dedicated inbound address.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          When should this workflow run?
        </span>
        <label className="flex items-center gap-2" style={{ fontSize: 12 }}>
          <input
            type="radio"
            name="inbound-email-criteria"
            checked={matchAll}
            onChange={chooseMatchAll}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            Run this workflow for every forwarded email
          </span>
        </label>
        <label className="flex items-center gap-2" style={{ fontSize: 12 }}>
          <input
            type="radio"
            name="inbound-email-criteria"
            checked={!matchAll}
            onChange={chooseCriteria}
          />
          <span style={{ color: "var(--text-secondary)" }}>Only when</span>
        </label>

        {!matchAll && (
          <div className="flex flex-col gap-3">
            <PlainField
              label="Variable"
              value={String(config["variable"] ?? "trigger.subject")}
              onChange={(v) => set("variable", v)}
              options={EMAIL_TRIGGER_VARIABLES}
            />
            <PlainField
              label="Condition"
              value={operator}
              onChange={(v) => set("operator", v)}
              options={OPERATORS}
            />
            {!["is_empty", "is_not_empty"].includes(operator) && (
              <PlainField
                label="Value"
                value={String(config["value"] ?? "")}
                onChange={(v) => set("value", v)}
                placeholder="e.g. quote request"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}




function WebhookUrlField({ workflowId }: { workflowId?: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const url = workflowId ? webhookUrlFor(workflowId) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
        Webhook URL
      </span>
      {url ? (
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <span
            className="min-w-0 flex-1 truncate"
            style={{ fontSize: 12, color: "var(--text-primary)" }}
            title={url}
          >
            {url}
          </span>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copy webhook URL"
            className="synkra-focus inline-flex items-center gap-1 rounded-md"
            style={{ fontSize: 12, color: "var(--accent-green)", padding: "2px 4px" }}
          >
            {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Save the workflow first to get your webhook URL
        </p>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        This is your unique link. Save the workflow, then paste this link into your website's
        contact form tool, such as Tally or Typeform, or give it to your web developer so every
        submission comes straight here.
      </p>
    </div>
  );
}

export function ConfigPanel({
  blocks,
  block,
  onChange,
  workflowId,
}: {
  blocks: WorkflowBlock[];
  block: WorkflowBlock | null;
  onChange: (blockId: string, config: Record<string, unknown>) => void;
  workflowId?: string | undefined;
}) {
  // Must run before any early return - React hooks cannot be called
  // conditionally. This was previously called after the `!block` check
  // below, which meant the hook ran on some renders and not others
  // (selecting vs. deselecting a block), a real rules-of-hooks violation
  // that could corrupt hook state across re-renders.
  const { data: integrations = {} } = useIntegrationsMap();

  if (!block) {
    return (
      <div className="p-4">
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Select a block to configure it.</p>
      </div>
    );
  }

  const index = blocks.findIndex((b) => b.id === block.id);
  const variables = availableVariableOptions(blocks, index);
  const config = block.config ?? {};
  const set = (key: string, value: unknown) => onChange(block.id, { ...config, [key]: value });
  const text = (key: string, fallback = "") => String(config[key] ?? fallback);
  const obj = (key: string): Record<string, unknown> => {
    const v = config[key];
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  };
  const subtype = blockSubtype(block);
  const definition = definitionFor(block);
  const configHint = definition?.configHint;
  const configNote = definition?.configNote;

  const requiresIntegration = definition?.requiresIntegration;
  const connected = integrationConnected(requiresIntegration, integrations);
  const needsMoreScopes = missingScopes(definition, block, integrations[requiresIntegration ?? ""]);

  const requirementsBanner = () => {
    if (!requiresIntegration) return null;
    if (!connected) {
      return (
        <div
          className="flex items-center justify-between gap-3 rounded-md p-3"
          style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--state-warning)" }}
        >
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            This block needs {requiresIntegration} connected to run.
          </p>
          {requiresIntegration === "hubspot" && <HubspotConnectButton label="Connect" />}
          {requiresIntegration === "slack" && <SlackConnectButton label="Connect" />}
          {requiresIntegration === "zoho" && <ZohoConnectButton label="Connect" />}
        </div>
      );
    }
    if (needsMoreScopes.length > 0) {
      return (
        <div
          className="flex items-center justify-between gap-3 rounded-md p-3"
          style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--state-warning)" }}
        >
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            This block needs additional {requiresIntegration} permissions ({needsMoreScopes.join(", ")}) that
            haven't been granted yet.
          </p>
          {/* hubspot and zoho both have /reauthorize endpoints now —
              slack doesn't yet, see nango-integration-architecture.md's
              checklist for extending this further. */}
          {requiresIntegration === "hubspot" && <HubspotReauthorizeButton missingScopes={needsMoreScopes} />}
          {requiresIntegration === "zoho" && <ZohoReauthorizeButton missingScopes={needsMoreScopes} />}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{block.label}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {block.description}
        </p>
        {configHint && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{configHint}</p>
        )}
        {configNote && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{configNote}</p>
        )}
      </div>

      {requirementsBanner()}

      {subtype === "webhook" && <WebhookUrlField workflowId={workflowId} />}

      {subtype === "webhook" && (
        <PlainField
          label="What information will this receive?"
          value={((config["expected_fields"] as string[] | undefined) ?? []).join(", ")}
          placeholder="name, email, message"
          onChange={(value) =>
            set(
              "expected_fields",
              value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
          hint="List what your form or website will send here, separated by commas — for example: name, email, message. You'll be able to use each one anywhere later in this workflow."
        />
      )}

      {subtype === "schedule" && (
        <>
          <PlainField
            label="Frequency"
            value={text("frequency", "daily")}
            onChange={(v) => set("frequency", v)}
            options={[
              { value: "hourly", label: "Hourly" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          <PlainField
            label="Time"
            type="time"
            value={text("time", "07:00")}
            onChange={(v) => set("time", v)}
          />
        </>
      )}

      {subtype === "email_received" && (
        <InboundEmailSetup
          config={config}
          set={set}
          replace={(next) => onChange(block.id, next)}
        />
      )}

      {subtype === "send_email" && (
        <>
          <VariableField
            label="To"
            value={text("to")}
            variables={variables}
            onChange={(v) => set("to", v)}
          />
          <VariableField
            label="Subject"
            value={text("subject")}
            variables={variables}
            onChange={(v) => set("subject", v)}
          />
          <VariableField
            label="Body"
            multiline
            value={text("body")}
            variables={variables}
            onChange={(v) => set("body", v)}
          />
        </>
      )}

      {subtype === "wait" && (
        <>
          <PlainField
            label="Duration"
            type="number"
            value={text("duration", "1")}
            onChange={(v) => set("duration", Number(v) || 0)}
          />
          <PlainField
            label="Unit"
            value={text("unit", "hours")}
            onChange={(v) => set("unit", v)}
            options={[
              { value: "minutes", label: "Minutes" },
              { value: "hours", label: "Hours" },
              { value: "days", label: "Days" },
            ]}
          />
        </>
      )}

      {(subtype === "save_information" || subtype === "find_information") && (
        <>
          <PlainField
            label="Collection"
            value={text("collection")}
            onChange={(v) => set("collection", v)}
          />
          {subtype === "find_information" ? (
            <>
              <VariableField
                label="Filter"
                value={text("filter")}
                variables={variables}
                onChange={(v) => set("filter", v)}
                hint='For example email = "{{payload.email}}"'
              />
              <PlainField
                label="Save result as"
                value={text("output_variable", "found_record")}
                onChange={(v) => set("output_variable", v)}
              />
            </>
          ) : (
            <VariableField
              label="Record ID (optional)"
              value={text("record_id")}
              variables={variables}
              onChange={(v) => set("record_id", v)}
            />
          )}
        </>
      )}

      {subtype === "generate_pdf" && (
        <PlainField
          label="Template"
          value={text("template", "Invoice")}
          onChange={(v) => set("template", v)}
          options={[
            { value: "Invoice", label: "Invoice" },
            { value: "Quote", label: "Quote" },
            { value: "Report", label: "Report" },
          ]}
        />
      )}

      {subtype === "summarise_ai" && (
        <>
          <VariableField
            label="Input text"
            multiline
            value={text("input")}
            variables={variables}
            onChange={(v) => set("input", v)}
          />
          <PlainField
            label="Save result as"
            value={text("output_variable", "ai_summary")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "extract_information_ai" && (
        <>
          <VariableField
            label="Input text"
            multiline
            value={text("input")}
            variables={variables}
            onChange={(v) => set("input", v)}
          />
          <ExtractFieldsEditor
            block={block}
            onChange={(entries) =>
              set(
                "fields",
                entries.reduce<Record<string, string>>((acc, [name, description], i) => {
                  // Keys are token-safe (customer_intent) so {{extracted.x}}
                  // resolves; rows with no name yet keep a placeholder key so
                  // the row survives until the user names it.
                  acc[toFieldKey(name) || `__new_${i}`] = description;
                  return acc;
                }, {}),
              )
            }
          />
          <PlainField
            label="Save result as"
            value={text("output_variable", "extracted")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "generate_reply_ai" && (
        <>
          <VariableField
            label="Message to reply to"
            multiline
            value={text("message")}
            variables={variables}
            onChange={(v) => set("message", v)}
          />
          <PlainField
            label="Tone"
            value={text("tone", "Professional")}
            onChange={(v) => set("tone", v)}
            options={[
              { value: "Professional", label: "Professional" },
              { value: "Friendly", label: "Friendly" },
              { value: "Direct", label: "Direct" },
            ]}
          />
          <PlainField
            label="Save result as"
            value={text("output_variable", "ai_reply")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {(subtype === "send_whatsapp" || subtype === "send_sms") && (
        <>
          <VariableField
            label="To"
            value={text("to")}
            variables={variables}
            onChange={(v) => set("to", v)}
          />
          <VariableField
            label="Message"
            multiline
            value={text("body")}
            variables={variables}
            onChange={(v) => set("body", v)}
          />
        </>
      )}

      {SLACK_TRIGGERS.includes(subtype) && (
        <>
          <SlackChannelPicker
            channelId={text("channel_id")}
            onChange={(v) => set("channel_id", v)}
          />
          {subtype === "slack_unanswered_check" && (
            <PlainField
              label="Flag as unanswered after _ hours"
              type="number"
              value={text("unanswered_after_hours", "4")}
              onChange={(v) => set("unanswered_after_hours", Number(v) || 0)}
              hint="We only flag a question once nobody has replied for this many hours."
            />
          )}
        </>
      )}

      {subtype === "classify_message_ai" && (
        <>
          <VariableField
            label="Message to classify"
            multiline
            value={text("message")}
            variables={variables}
            onChange={(v) => set("message", v)}
          />
          <PlainField
            label="Categories"
            value={((config["categories"] as string[] | undefined) ?? []).join(", ")}
            placeholder="urgent - needs immediate attention, normal - no action needed"
            onChange={(value) =>
              set(
                "categories",
                value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
            hint="List the categories you want, separated by commas. The AI picks exactly one of them."
          />
          <PlainField
            label="Save result as"
            value={text("output_variable", "classification")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "send_notification" && (
        <>
          <VariableField
            label="Title"
            value={text("title")}
            variables={variables}
            onChange={(v) => set("title", v)}
          />
          <VariableField
            label="Body"
            multiline
            value={text("body")}
            variables={variables}
            onChange={(v) => set("body", v)}
          />
          <VariableField
            label="Link (optional)"
            value={text("link")}
            variables={variables}
            onChange={(v) => set("link", v)}
            hint="Where clicking the notification should take you, for example /dashboard/activity."
          />
        </>
      )}

      {(subtype === "if_else" || subtype === "filter") && (
        <>
          <VariableField
            label="Variable"
            value={text("variable")}
            variables={variables}
            onChange={(v) => set("variable", v)}
          />
          <PlainField
            label="Condition"
            value={text("operator", "equals")}
            onChange={(v) => set("operator", v)}
            options={OPERATORS}
          />
          {!["is_empty", "is_not_empty"].includes(text("operator", "equals")) && (
            <VariableField
              label="Value"
              value={text("value")}
              variables={variables}
              onChange={(v) => set("value", v)}
            />
          )}
        </>
      )}

      {subtype === "hubspot_new_contact" && (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          No setup needed — this fires for every new HubSpot contact once connected.
        </p>
      )}

      {subtype === "hubspot_deal_stage_changed" && (
        <VariableField
          label="Only when the new stage is"
          hint="Leave blank to fire on any stage change, or set a specific stage's internal name (e.g. closedwon)."
          value={text("value")}
          variables={variables}
          onChange={(v) => {
            set("value", v);
            set("match_all", v.trim() === "");
          }}
        />
      )}

      {subtype === "hubspot_find_contact" && (
        <>
          <VariableField
            label="Email"
            value={text("email")}
            variables={variables}
            onChange={(v) => set("email", v)}
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "hubspot_contact")}
            onChange={(v) => set("output_variable", v)}
            hint="Reference this later as {{hubspot_contact}} (or whatever name you pick)."
          />
        </>
      )}

      {(subtype === "hubspot_create_contact" || subtype === "hubspot_update_contact") && (
        <>
          {subtype === "hubspot_update_contact" && (
            <VariableField
              label="Contact ID"
              value={text("contact_id")}
              variables={variables}
              onChange={(v) => set("contact_id", v)}
            />
          )}
          <JsonField
            label="Properties"
            value={obj("properties")}
            onChange={(v) => set("properties", v)}
            hint='HubSpot contact property names to values, e.g. {"email": "{{trigger.email}}", "firstname": "{{trigger.name}}"}. Variables work inside the string values.'
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "hubspot_contact")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "hubspot_find_deal" && (
        <>
          <VariableField
            label="Deal name"
            value={text("deal_name")}
            variables={variables}
            onChange={(v) => set("deal_name", v)}
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "hubspot_deal")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {(subtype === "hubspot_create_deal" || subtype === "hubspot_update_deal") && (
        <>
          {subtype === "hubspot_update_deal" && (
            <VariableField
              label="Deal ID"
              value={text("deal_id")}
              variables={variables}
              onChange={(v) => set("deal_id", v)}
            />
          )}
          <JsonField
            label="Properties"
            value={obj("properties")}
            onChange={(v) => set("properties", v)}
            hint='e.g. {"dealname": "{{trigger.company}} deal", "pipeline": "default", "dealstage": "appointmentscheduled"}'
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "hubspot_deal")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "hubspot_add_note" && (
        <>
          <VariableField
            label="Contact ID"
            value={text("contact_id")}
            variables={variables}
            onChange={(v) => set("contact_id", v)}
          />
          <VariableField
            label="Note"
            multiline
            value={text("note_body")}
            variables={variables}
            onChange={(v) => set("note_body", v)}
          />
        </>
      )}

      {subtype === "send_slack_message" && (
        <>
          <SlackChannelPicker
            channelId={text("channel_id")}
            onChange={(v) => set("channel_id", v)}
          />
          <VariableField
            label="Message"
            multiline
            value={text("text")}
            variables={variables}
            onChange={(v) => set("text", v)}
          />
        </>
      )}

      {subtype === "zoho_find_contact" && (
        <>
          <VariableField
            label="Email"
            value={text("email")}
            variables={variables}
            onChange={(v) => set("email", v)}
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "zoho_contact")}
            onChange={(v) => set("output_variable", v)}
            hint="Reference this later as {{zoho_contact}} (or whatever name you pick)."
          />
        </>
      )}

      {(subtype === "zoho_create_contact" || subtype === "zoho_update_contact") && (
        <>
          {subtype === "zoho_update_contact" && (
            <VariableField
              label="Contact ID"
              value={text("contact_id")}
              variables={variables}
              onChange={(v) => set("contact_id", v)}
            />
          )}
          <JsonField
            label="Fields"
            value={obj("fields")}
            onChange={(v) => set("fields", v)}
            hint='Zoho Books contact fields, e.g. {"contact_name": "{{trigger.company}}", "email": "{{trigger.email}}"}. Variables work inside the string values.'
          />
          {subtype === "zoho_create_contact" && (
            <PlainField
              label="Store result as"
              value={text("output_variable", "zoho_contact")}
              onChange={(v) => set("output_variable", v)}
            />
          )}
        </>
      )}

      {subtype === "zoho_find_invoice" && (
        <>
          <VariableField
            label="Invoice number"
            value={text("invoice_number")}
            variables={variables}
            onChange={(v) => set("invoice_number", v)}
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "zoho_invoice")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "zoho_create_invoice" && (
        <>
          <JsonField
            label="Fields"
            value={obj("fields")}
            onChange={(v) => set("fields", v)}
            hint='Needs at least customer_id and line_items, e.g. {"customer_id": "{{zoho_contact.contact_id}}", "line_items": [{"name": "Service", "rate": 100, "quantity": 1}]}'
          />
          <PlainField
            label="Store result as"
            value={text("output_variable", "zoho_invoice")}
            onChange={(v) => set("output_variable", v)}
          />
        </>
      )}

      {subtype === "zoho_add_invoice_comment" && (
        <>
          <VariableField
            label="Invoice ID"
            value={text("invoice_id")}
            variables={variables}
            onChange={(v) => set("invoice_id", v)}
          />
          <VariableField
            label="Comment"
            multiline
            value={text("comment")}
            variables={variables}
            onChange={(v) => set("comment", v)}
            hint="Internal only — visible in the invoice's activity log, never on the customer-facing PDF."
          />
        </>
      )}

      {subtype === "custom_api_call" && (
        <>
          <PlainField
            label="Platform"
            value={text("integration")}
            onChange={(v) => set("integration", v)}
            options={[
              { value: "", label: "Choose a connected platform…" },
              ...Object.entries(integrations)
                .filter(([, record]) => record.status === "connected")
                .map(([key]) => ({ value: key, label: key.charAt(0).toUpperCase() + key.slice(1) })),
            ]}
            hint="Only platforms you've connected show up here — connect more under Settings → Integrations."
          />
          <PlainField
            label="Method"
            value={text("method", "GET")}
            onChange={(v) => set("method", v)}
            options={["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => ({ value: m, label: m }))}
          />
          <VariableField
            label="Endpoint"
            value={text("endpoint")}
            variables={variables}
            onChange={(v) => set("endpoint", v)}
            placeholder="crm/v3/objects/companies"
            hint="Relative path on the platform's API — check its API docs for what's available."
          />
          {text("method", "GET") !== "GET" && (
            <JsonField label="Body" value={obj("body")} onChange={(v) => set("body", v)} />
          )}
          <PlainField
            label="Store result as"
            value={text("output_variable", "api_response")}
            onChange={(v) => set("output_variable", v)}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            If this call needs a permission you haven't granted yet, it will fail with a clear
            error when tested — reconnect the platform under Settings → Integrations to add it.
            Automatic per-endpoint permission checking isn't available for custom calls yet, only
            for the ready-made blocks above.
          </p>
        </>
      )}
    </div>

  );
}
