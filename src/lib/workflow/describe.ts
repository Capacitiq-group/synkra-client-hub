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

/** Variables available to a block, based on the blocks that run before it. */
export function availableVariables(blocks: WorkflowBlock[], upToIndex: number): string[] {
  const variables = new Set<string>(["{{user.email}}", "{{user.name}}", "{{user.business_name}}"]);

  blocks.slice(0, Math.max(upToIndex, 0)).forEach((block) => {
    if (block.type === "trigger") {
      const fields = (block.config["expected_fields"] as string[] | undefined) ?? [];
      fields.forEach((field) => variables.add(`{{payload.${field}}}`));
      if (!fields.length) variables.add("{{payload}}");
    }
    const output = block.config["output_variable"];
    if (typeof output === "string" && output) variables.add(`{{${output}}}`);
  });

  return Array.from(variables);
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
