import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { webhookUrlFor } from "@/lib/workflow/api";
import { OPERATORS, blockSubtype } from "@/lib/workflow/blocks";
import { availableVariables } from "@/lib/workflow/describe";
import type { WorkflowBlock } from "@/lib/workflow/types";
import { PlainField, VariableField } from "./variables-popover";

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
        POST JSON data to this URL to trigger this workflow.
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

  if (!block) {
    return (
      <div className="p-4">
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Select a block to configure it.</p>
      </div>
    );
  }

  const index = blocks.findIndex((b) => b.id === block.id);
  const variables = availableVariables(blocks, index);
  const config = block.config ?? {};
  const set = (key: string, value: unknown) => onChange(block.id, { ...config, [key]: value });
  const text = (key: string, fallback = "") => String(config[key] ?? fallback);
  const subtype = blockSubtype(block);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{block.label}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {block.description}
        </p>
      </div>

      {subtype === "webhook" && <WebhookUrlField workflowId={workflowId} />}

      {subtype === "webhook" && (

        <VariableField
          label="Expected fields"
          value={((config["expected_fields"] as string[] | undefined) ?? []).join(", ")}
          variables={[]}
          onChange={(value) =>
            set(
              "expected_fields",
              value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
          hint="Comma separated. These become {{payload.field}} variables."
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
        <PlainField
          label="Monitored address"
          value={text("address")}
          onChange={(v) => set("address", v)}
          placeholder="inbox@yourbusiness.co.za"
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

      {(subtype === "summarise_ai" || subtype === "extract_information_ai") && (
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
    </div>
  );
}
