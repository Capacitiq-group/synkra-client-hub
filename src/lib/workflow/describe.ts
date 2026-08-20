import { definitionFor, blockSubtype } from "./blocks";
import type { WorkflowBlock } from "./types";

/** Plain-language sentence for a single block, used in gallery cards and previews. */
export function describeBlock(block: WorkflowBlock): string {
  const subtype = blockSubtype(block);

  if (block.type === "trigger") {
    const detail =
      subtype === "schedule"
        ? `${String(block.config["frequency"] ?? "daily")} at ${String(block.config["time"] ?? "07:00")}`
        : subtype === "webhook"
          ? (block.description ?? "data arrives from an external system").toLowerCase()
          : (block.description ?? block.label).toLowerCase();
    return `Starts when ${detail}`;
  }

  if (subtype === "wait") {
    const until = block.config["wait_until"];
    if (typeof until === "string" && until) return `Waits until ${until} then continues`;
    const duration = block.config["duration"];
    const unit = block.config["unit"] ?? "hours";
    if (duration) return `Waits ${String(duration)} ${String(unit)} then continues`;
    return "Waits then continues";
  }

  return block.label;
}

/** Short summary of a block's configuration shown under the node on the canvas. */
export function summariseConfig(block: WorkflowBlock): string | null {
  const subtype = blockSubtype(block);
  const config = block.config ?? {};

  switch (subtype) {
    case "webhook": {
      const fields = (config["expected_fields"] as string[] | undefined) ?? [];
      return fields.length ? `Expects: ${fields.join(", ")}` : null;
    }
    case "schedule":
      return `${String(config["frequency"] ?? "daily")} at ${String(config["time"] ?? "07:00")}`;
    case "email_received":
      return config["address"] ? `Watches ${String(config["address"])}` : null;
    case "send_email":
      return config["to"] && config["subject"]
        ? `To ${String(config["to"])} with subject ${String(config["subject"])}`
        : null;
    case "wait": {
      const until = config["wait_until"];
      if (typeof until === "string" && until) return `Pauses until ${until}`;
      return config["duration"]
        ? `Pauses for ${String(config["duration"])} ${String(config["unit"] ?? "hours")}`
        : null;
    }
    case "save_information":
      return config["collection"] ? `Saves into ${String(config["collection"])}` : null;
    case "find_information":
      return config["collection"] ? `Looks in ${String(config["collection"])}` : null;
    case "generate_pdf":
      return config["template"] ? `Uses the ${String(config["template"])} template` : null;
    case "summarise_ai":
      return config["input"]
        ? `Summarises into {{${String(config["output_variable"] ?? "ai_summary")}}}`
        : null;
    case "generate_reply_ai":
      return config["message"]
        ? `Writes a ${String(config["tone"] ?? "Professional").toLowerCase()} reply`
        : null;
    case "extract_information_ai":
      return config["input"]
        ? `Extracts into {{${String(config["output_variable"] ?? "extracted")}}}`
        : null;
    case "send_whatsapp":
    case "send_sms":
      return config["to"] ? `Sends to ${String(config["to"])}` : null;
    case "if_else":
    case "filter":
      return config["variable"]
        ? `${String(config["variable"])} ${String(config["operator"] ?? "equals")} ${String(config["value"] ?? "")}`
        : null;
    default:
      return null;
  }
}

export function isConfigured(block: WorkflowBlock): boolean {
  const subtype = blockSubtype(block);
  const config = block.config ?? {};
  const filled = (key: string) => {
    const value = config[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  };

  switch (subtype) {
    case "webhook":
      return true;
    case "schedule":
      return filled("frequency") && filled("time");
    case "email_received":
      return filled("address");
    case "send_email":
      return filled("to") && filled("subject") && filled("body");
    case "wait":
      return filled("wait_until") || filled("duration");
    case "save_information":
      return filled("collection");
    case "find_information":
      return filled("collection") && filled("filter");
    case "generate_pdf":
      return filled("template");
    case "summarise_ai":
      return filled("input");
    case "generate_reply_ai":
      return filled("message");
    case "extract_information_ai":
      return filled("input");
    case "send_whatsapp":
    case "send_sms":
      return filled("to") && filled("body");
    case "if_else":
    case "filter":
      return (
        filled("variable") &&
        (["is_empty", "is_not_empty"].includes(String(config["operator"])) || filled("value"))
      );
    default:
      return Boolean(definitionFor(block));
  }
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  blockId?: string;
}

export function validateWorkflow(blocks: WorkflowBlock[]): ValidationResult {
  if (!blocks.some((b) => b.type === "trigger")) {
    return { ok: false, message: "Add a trigger to start your workflow." };
  }
  if (!blocks.some((b) => b.type === "action")) {
    return { ok: false, message: "Add at least one action after your trigger." };
  }
  const unconfigured = blocks.find((b) => !isConfigured(b));
  if (unconfigured) {
    return {
      ok: false,
      message: "Some blocks are not fully configured.",
      blockId: unconfigured.id,
    };
  }
  return { ok: true };
}

/** One entry in the "Insert variable" picker: friendly name + the real token. */
export interface VariableOption {
  /** The literal {{...}} token inserted into the field. */
  token: string;
  /** Human-readable name shown to the user. */
  label: string;
  /** One-line explanation of where the value comes from. */
  description: string;
}

/** Turns a raw field name such as customer_email into "Customer email". */
function humanizeFieldName(field: string): string {
  const words = field.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  if (!words) return field;
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** Friendlier names for the field names small businesses use most often. */
const COMMON_FIELD_LABELS: Record<string, string> = {
  email: "Customer's email",
  customer_email: "Customer's email",
  name: "Customer's name",
  customer_name: "Customer's name",
  full_name: "Customer's full name",
  first_name: "Customer's first name",
  last_name: "Customer's last name",
  phone: "Customer's phone number",
  mobile: "Customer's phone number",
  message: "What the customer wrote",
  subject: "Subject line they used",
  company: "Customer's company",
  amount: "Amount",
  invoice_number: "Invoice number",
  due_date: "Due date",
};

function payloadFieldLabel(field: string): string {
  return COMMON_FIELD_LABELS[field.toLowerCase()] ?? humanizeFieldName(field);
}

/** Reads a trigger's expected fields, tolerating a comma-separated string. */
export function triggerFields(block: WorkflowBlock): string[] {
  const raw = (block.config ?? {})["expected_fields"];
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean);
  if (typeof raw === "string")
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  return [];
}

/** Reads an extract-with-AI block's field definitions as name -> description. */
export function extractFieldEntries(block: WorkflowBlock): Array<[string, string]> {
  const raw = (block.config ?? {})["fields"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([name, description]) => [
    name,
    String(description ?? ""),
  ]);
}

/**
 * Variables available to a block, with friendly labels.
 *
 * A trigger always runs first, whatever its position in the array, so its
 * payload fields are offered to every other block. Everything else is scoped
 * to the blocks that genuinely run before `upToIndex`.
 */
export function availableVariableOptions(
  blocks: WorkflowBlock[],
  upToIndex: number,
): VariableOption[] {
  const options: VariableOption[] = [];
  const seen = new Set<string>();
  const push = (option: VariableOption) => {
    if (seen.has(option.token)) return;
    seen.add(option.token);
    options.push(option);
  };

  push({
    token: "{{user.email}}",
    label: "Your email address",
    description: "The email address on your Synkra account.",
  });
  push({
    token: "{{user.name}}",
    label: "Your name",
    description: "Your name as it appears on your Synkra account.",
  });
  push({
    token: "{{user.business_name}}",
    label: "Your business name",
    description: "The business name on your Synkra account.",
  });

  // Triggers first — they always run before every other block.
  blocks
    .filter((block) => block.type === "trigger")
    .forEach((block) => {
      const fields = triggerFields(block);
      fields.forEach((field) =>
        push({
          token: `{{payload.${field}}}`,
          label: payloadFieldLabel(field),
          description: `The "${field}" value sent in when this workflow starts.`,
        }),
      );
      if (!fields.length)
        push({
          token: "{{payload}}",
          label: "Everything that was sent in",
          description: "All the information received when this workflow starts.",
        });
    });

  const before = blocks.slice(0, Math.max(upToIndex, 0));
  before.forEach((block) => {
    if (block.type === "trigger") return;
    const output = (block.config ?? {})["output_variable"];
    if (typeof output !== "string" || !output) return;
    const subtype = blockSubtype(block);

    if (subtype === "extract_information_ai") {
      const fields = extractFieldEntries(block);
      fields.forEach(([name, description]) =>
        push({
          token: `{{${output}.${name}}}`,
          label: description.trim() || humanizeFieldName(name),
          description: `Pulled out of the text by the "${block.label}" step.`,
        }),
      );
      push({
        token: `{{${output}}}`,
        label: "Everything the AI pulled out",
        description: `All the details found by the "${block.label}" step, together.`,
      });
      return;
    }

    const label =
      subtype === "summarise_ai"
        ? "AI summary"
        : subtype === "generate_reply_ai"
          ? "AI-written reply"
          : subtype === "find_information"
            ? "The record that was found"
            : humanizeFieldName(output);
    const description =
      subtype === "summarise_ai"
        ? `The short summary written by the "${block.label}" step.`
        : subtype === "generate_reply_ai"
          ? `The reply written for you by the "${block.label}" step.`
          : `The result saved by the "${block.label}" step.`;
    push({ token: `{{${output}}}`, label, description });
  });

  return options;
}

/** Raw tokens only — kept for callers that just need the {{...}} strings. */
export function availableVariables(blocks: WorkflowBlock[], upToIndex: number): string[] {
  return availableVariableOptions(blocks, upToIndex).map((option) => option.token);
}

/** Sample payload used to pre-populate the test modal. */
export function sampleInputFor(blocks: WorkflowBlock[]): Record<string, unknown> {
  const trigger = blocks.find((b) => b.type === "trigger");
  if (!trigger) return {};
  if (trigger.trigger_type === "schedule") return { trigger: "schedule" };
  const fields = (trigger.config["expected_fields"] as string[] | undefined) ?? [];
  const payload: Record<string, string> = {};
  fields.forEach((field) => {
    if (field.includes("email")) payload[field] = "sample@example.com";
    else if (field.includes("phone")) payload[field] = "+27820000000";
    else if (field.includes("amount")) payload[field] = "1500.00";
    else if (field.includes("date")) payload[field] = new Date().toISOString();
    else payload[field] = `Sample ${field.replace(/_/g, " ")}`;
  });
  return { payload };
}
