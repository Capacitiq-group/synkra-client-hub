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
      if (config["match_all"]) return "Runs for every forwarded email";
      return config["variable"]
        ? `${String(config["variable"])} ${String(config["operator"] ?? "contains")} ${String(config["value"] ?? "")}`
        : null;

    case "typeform_response_received":
    case "tally_submission_received":
      return config["form_id"]
        ? `Form ${String(config["form_id"])}`
        : null;

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
      return config["template"]
        ? `Uses the ${String(config["template"])} template`
        : null;

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
      // Forwarding is set up at account level; the trigger itself is always
      // runnable (either match-all or a criteria row).
      return Boolean(config["match_all"]) || filled("variable");

    case "typeform_response_received":
    case "tally_submission_received":
      // The webhook receiver rejects events when no form is selected, so an
      // empty form must block publish rather than silently 400 at runtime.
      return filled("form_id");

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
        (["is_empty", "is_not_empty"].includes(String(config["operator"])) ||
          filled("value"))
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
export function humanizeFieldName(field: string): string {
  const words = field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  if (!words) return field;

  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * Turns a human-typed field name into a token-safe key.
 *
 * Templating only understands {{word.characters}}, so "Customer intent" is
 * stored as customer_intent and shown back to the user as "Customer intent".
 */
export function toFieldKey(name: string): string {
  return name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
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

  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

/** Reads an extract-with-AI block's field definitions as name -> description. */
export function extractFieldEntries(block: WorkflowBlock): Array<[string, string]> {
  const raw = (block.config ?? {})["fields"];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  return Object.entries(raw as Record<string, unknown>).map(([name, description]) => [
    name,
    String(description ?? ""),
  ]);
}

/**
 * Trigger variables whose backend context is explicitly constructed
 * by Synkra rather than coming from the generic `payload` trigger.
 *
 * Keeping this mapping here makes the variable picker derive its
 * provider-specific contract from the trigger type instead of pretending
 * every provider uses `payload.*`.
 */
const TYPEFORM_TRIGGER_VARIABLES: VariableOption[] = [
  {
    token: "{{trigger.event_id}}",
    label: "Typeform event ID",
    description: "The unique ID of the Typeform webhook event.",
  },
  {
    token: "{{trigger.event_type}}",
    label: "Event type",
    description: "The Typeform event type that started this workflow.",
  },
  {
    token: "{{trigger.form_id}}",
    label: "Typeform form ID",
    description: "The ID of the Typeform form that received the response.",
  },
  {
    token: "{{trigger.token}}",
    label: "Response token",
    description: "The unique token identifying the submitted Typeform response.",
  },
  {
    token: "{{trigger.response_url}}",
    label: "Response URL",
    description: "The URL for the submitted Typeform response.",
  },
  {
    token: "{{trigger.submitted_at}}",
    label: "Submitted at",
    description: "The timestamp when the response was submitted.",
  },
  {
    token: "{{trigger.landed_at}}",
    label: "Landed at",
    description: "The timestamp when the respondent landed on the form.",
  },
  {
    token: "{{trigger.hidden}}",
    label: "Hidden fields",
    description: "The hidden values supplied with the Typeform response.",
  },
  {
    token: "{{trigger.answers}}",
    label: "Typeform answers",
    description: "The submitted answers, keyed by their Typeform question titles.",
  },
];

/**
 * Trigger variables for the Tally webhook trigger, following the same
 * provider-specific contract as TYPEFORM_TRIGGER_VARIABLES above.
 */
const TALLY_TRIGGER_VARIABLES: VariableOption[] = [
  {
    token: "{{trigger.event_id}}",
    label: "Tally event ID",
    description: "The unique ID of the Tally webhook event.",
  },
  {
    token: "{{trigger.event_type}}",
    label: "Event type",
    description: "The Tally webhook event type.",
  },
  {
    token: "{{trigger.created_at}}",
    label: "Event created at",
    description: "When Tally created the webhook event.",
  },
  {
    token: "{{trigger.response_id}}",
    label: "Response ID",
    description: "The ID of the Tally response.",
  },
  {
    token: "{{trigger.submission_id}}",
    label: "Submission ID",
    description: "The ID of the Tally submission.",
  },
  {
    token: "{{trigger.respondent_id}}",
    label: "Respondent ID",
    description: "The ID of the respondent who submitted the form.",
  },
  {
    token: "{{trigger.form_id}}",
    label: "Tally form ID",
    description: "The ID of the Tally form that received the submission.",
  },
  {
    token: "{{trigger.form_name}}",
    label: "Tally form name",
    description: "The name of the Tally form.",
  },
  {
    token: "{{trigger.submission_pdf_url}}",
    label: "Submission PDF",
    description: "The URL for the PDF version of the submission.",
  },
  {
    token: "{{trigger.submission_preview_url}}",
    label: "Submission preview",
    description: "The URL for the Tally submission preview.",
  },
  {
    token: "{{trigger.fields}}",
    label: "All submitted fields",
    description: "The original Tally fields array received from the webhook.",
  },
  {
    token: "{{trigger.answers}}",
    label: "Tally answers",
    description: "Submitted answers keyed by the Tally field labels.",
  },
];

export function knownTriggerVariables(triggerType: string): VariableOption[] {
  switch (triggerType) {
    case "typeform_response_received":
      return TYPEFORM_TRIGGER_VARIABLES;

    case "tally_submission_received":
      return TALLY_TRIGGER_VARIABLES;

    default:
      return [];
  }
}

/**
 * Variables available to a block, with friendly labels.
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

  /*
   * Provider-specific trigger variables.
   *
   * Do this before the generic webhook fallback because provider
   * triggers do not necessarily expose an `expected_fields` payload.
   */
  blocks
    .filter((block) => block.type === "trigger")
    .forEach((block) => {
      const providerVariables = knownTriggerVariables(block.trigger_type ?? "");

      providerVariables.forEach(push);

      if (providerVariables.length > 0) {
        return;
      }

      /*
       * The generic webhook trigger is intentionally payload-based.
       * Preserve that established contract rather than changing all
       * existing webhook workflows.
       */
      const fields = triggerFields(block);

      fields.forEach((field) =>
        push({
          token: `{{payload.${field}}}`,
          label: payloadFieldLabel(field),
          description: `The "${field}" value sent in when this workflow starts.`,
        }),
      );

      if (!fields.length) {
        push({
          token: "{{payload}}",
          label: "Everything that was sent in",
          description: "All the information received when this workflow starts.",
        });
      }
    });

  const before = blocks.slice(0, Math.max(upToIndex, 0));

  before.forEach((block) => {
    if (block.type === "trigger") return;

    const output = (block.config ?? {})["output_variable"];

    if (typeof output !== "string" || !output) {
      return;
    }

    const subtype = blockSubtype(block);

    if (subtype === "extract_information_ai") {
      const fields = extractFieldEntries(block);

      fields
        .filter(
          ([name]) =>
            name.trim() &&
            !name.startsWith("__new_"),
        )
        .forEach(([name, description]) =>
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

    push({
      token: `{{${output}}}`,
      label,
      description,
    });
  });

  return options;
}

/** Raw tokens only. */
export function availableVariables(
  blocks: WorkflowBlock[],
  upToIndex: number,
): string[] {
  return availableVariableOptions(blocks, upToIndex).map((option) => option.token);
}

/** Sample payload used to pre-populate the test modal. */
export function sampleInputFor(
  blocks: WorkflowBlock[],
): Record<string, unknown> {
  const trigger = blocks.find((b) => b.type === "trigger");

  if (!trigger) return {};

  if (trigger.trigger_type === "schedule") {
    return {
      trigger: "schedule",
    };
  }

  if (trigger.trigger_type === "typeform_response_received") {
    return {
      trigger: {
        event_id: "sample-event-id",
        event_type: "form_response",
        form_id: String(trigger.config["form_id"] ?? "sample-form-id"),
        token: "sample-response-token",
        response_url: "https://example.typeform.com/responses/sample",
        submitted_at: new Date().toISOString(),
        landed_at: new Date().toISOString(),
        hidden: {},
        answers: {
          Email: "sample@example.com",
          Name: "Sample Customer",
        },
      },
    };
  }

  if (trigger.trigger_type === "tally_submission_received") {
    return {
      trigger: {
        event_id: "sample-event-id",
        event_type: "FORM_RESPONSE",
        created_at: new Date().toISOString(),
        response_id: "sample-response-id",
        submission_id: "sample-submission-id",
        respondent_id: "sample-respondent-id",
        form_id: String(trigger.config["form_id"] ?? "sample-form-id"),
        form_name: "Sample Tally form",
        submission_pdf_url: "https://tally.so/submissions/sample.pdf",
        submission_preview_url: "https://tally.so/submissions/sample",
        fields: [
          { key: "question_email", label: "Email", type: "INPUT_EMAIL", value: "sample@example.com" },
          { key: "question_name", label: "Name", type: "INPUT_TEXT", value: "Sample Customer" },
        ],
        answers: {
          Email: "sample@example.com",
          Name: "Sample Customer",
        },
      },
    };
  }

  const fields =
    (trigger.config["expected_fields"] as string[] | undefined) ?? [];

  const payload: Record<string, string> = {};

  fields.forEach((field) => {
    if (field.includes("email")) {
      payload[field] = "sample@example.com";
    } else if (field.includes("phone")) {
      payload[field] = "+27820000000";
    } else if (field.includes("amount")) {
      payload[field] = "1500.00";
    } else if (field.includes("date")) {
      payload[field] = new Date().toISOString();
    } else {
      payload[field] = `Sample ${field.replace(/_/g, " ")}`;
    }
  });

  return {
    payload,
  };
}
