import {
  Clock,
  Database,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Scissors,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { BlockKind, WorkflowBlock } from "./types";

export interface BlockDefinition {
  key: string;
  kind: BlockKind;
  /** trigger_type, action_type or logic_type value stored on the block */
  subtype: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  section: "TRIGGERS" | "ACTIONS" | "LOGIC";
  usesCredits?: boolean;
  comingSoon?: boolean;
  /**
   * One-line, jargon-free explainer shown under the block title inside the
   * config panel. Written for someone with no technical background.
   */
  configHint?: string;
  defaultConfig: Record<string, unknown>;
}

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    key: "webhook",
    configHint: "Starts this workflow whenever your website form (or another tool) sends through a submission.",
    kind: "trigger",
    subtype: "webhook",
    label: "Webhook",
    description: "Receives data from a form, website, or external system",
    icon: Globe,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    defaultConfig: { expected_fields: ["name", "email"] },
  },
  {
    key: "schedule",
    configHint: "Starts this workflow on its own at the time you choose — no one has to click anything.",
    kind: "trigger",
    subtype: "schedule",
    label: "Schedule",
    description: "Runs at a specific time or interval",
    icon: Clock,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    defaultConfig: {
      frequency: "daily",
      time: "07:00",
      timezone: "Africa/Johannesburg",
      days: [],
    },
  },
  {
    key: "email_received",
    configHint: "Starts this workflow when an email lands in the address below.",
    kind: "trigger",
    subtype: "email_received",
    label: "Email received",
    description: "Fires when an email arrives at a monitored address",
    icon: Mail,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    defaultConfig: { address: "" },
  },
  {
    key: "send_email",
    configHint: "Sends an email automatically. You can drop in details from earlier steps, like the customer's name.",
    kind: "action",
    subtype: "send_email",
    label: "Send email",
    description: "Sends an email",
    icon: Send,
    color: "var(--state-info)",
    section: "ACTIONS",
    defaultConfig: { to: "", subject: "", body: "" },
  },
  {
    key: "wait",
    configHint: "Pauses here for a while before carrying on with the next step.",
    kind: "action",
    subtype: "wait",
    label: "Wait",
    description: "Pauses the workflow for a set time",
    icon: Timer,
    color: "var(--state-warning)",
    section: "ACTIONS",
    defaultConfig: { duration: 1, unit: "hours" },
  },
  {
    key: "save_information",
    comingSoon: true,
    configHint: "Stores details from this workflow so you can look them up later.",
    kind: "action",
    subtype: "save_information",
    label: "Save information",
    description: "Creates or updates a record",
    icon: Database,
    color: "var(--state-info)",
    section: "ACTIONS",
    defaultConfig: { collection: "", record_id: "", fields: {} },
  },
  {
    key: "find_information",
    comingSoon: true,
    configHint: "Looks up something you saved earlier and brings it into this workflow.",
    kind: "action",
    subtype: "find_information",
    label: "Find information",
    description: "Looks up a record",
    icon: Search,
    color: "var(--state-info)",
    section: "ACTIONS",
    defaultConfig: { collection: "", filter: "", output_variable: "found_record" },
  },
  {
    key: "generate_pdf",
    comingSoon: true,
    configHint: "Creates a PDF document from the details in this workflow.",
    kind: "action",
    subtype: "generate_pdf",
    label: "Generate PDF",
    description: "Creates a PDF document",
    icon: FileText,
    color: "var(--state-info)",
    section: "ACTIONS",
    defaultConfig: { template: "Invoice", fields: {} },
  },
  {
    key: "summarise_ai",
    configHint: "Turns a long piece of text into a short summary you can reuse in later steps and messages.",
    kind: "action",
    subtype: "summarise_ai",
    label: "Summarise with AI",
    description: "Summarises text into a short overview",
    icon: Sparkles,
    color: "#8B5CF6",
    section: "ACTIONS",
    usesCredits: true,
    defaultConfig: { input: "", max_words: 100, output_variable: "ai_summary" },
  },
  {
    key: "generate_reply_ai",
    configHint: "Writes a reply for you in the tone you pick, based on the message you point it at.",
    kind: "action",
    subtype: "generate_reply_ai",
    label: "Generate reply with AI",
    description: "Writes a reply to a message",
    icon: MessageSquare,
    color: "#8B5CF6",
    section: "ACTIONS",
    usesCredits: true,
    defaultConfig: { context: "", message: "", tone: "Professional", output_variable: "ai_reply" },
  },
  {
    key: "extract_information_ai",
    configHint: "Reads a message and pulls out the specific details you ask for, so later steps can use them.",
    kind: "action",
    subtype: "extract_information_ai",
    label: "Extract information with AI",
    description: "Pulls specific data out of text",
    icon: Scissors,
    color: "#8B5CF6",
    section: "ACTIONS",
    usesCredits: true,
    defaultConfig: { input: "", fields: {}, output_variable: "extracted" },
  },
  {
    key: "send_whatsapp",
    configHint: "Sends a WhatsApp message.",
    kind: "action",
    subtype: "send_whatsapp",
    label: "Send WhatsApp",
    description: "Sends a WhatsApp message",
    icon: MessageCircle,
    color: "#25D366",
    section: "ACTIONS",
    comingSoon: true,
    defaultConfig: { to: "", body: "" },
  },
  {
    key: "send_sms",
    configHint: "Sends a text message.",
    kind: "action",
    subtype: "send_sms",
    label: "Send SMS",
    description: "Sends an SMS",
    icon: Smartphone,
    color: "#25D366",
    section: "ACTIONS",
    comingSoon: true,
    defaultConfig: { to: "", body: "" },
  },
  {
    key: "if_else",
    configHint: "Check something and remember the result, so later steps and messages can refer to it.",
    kind: "logic",
    subtype: "if_else",
    label: "Make a decision",
    description: "Sends the workflow down one of two paths",
    icon: GitBranch,
    color: "var(--state-warning)",
    section: "LOGIC",
    defaultConfig: {
      variable: "",
      operator: "equals",
      value: "",
      true_label: "Yes",
      false_label: "No",
    },
  },
  {
    key: "filter",
    configHint: "Checks one thing before going further — if it isn't true, the workflow simply stops here.",
    kind: "logic",
    subtype: "filter",
    label: "Only continue if",
    description: "Stops the workflow if the condition is not met",
    icon: Filter,
    color: "var(--state-warning)",
    section: "LOGIC",
    defaultConfig: { variable: "", operator: "equals", value: "" },
  },
];

export const OPERATORS: { value: string; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Is greater than" },
  { value: "less_than", label: "Is less than" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

export function blockSubtype(block: WorkflowBlock): string {
  return block.trigger_type || block.action_type || block.logic_type || "";
}

export function definitionFor(block: WorkflowBlock): BlockDefinition | undefined {
  const subtype = blockSubtype(block);
  return BLOCK_DEFINITIONS.find((d) => d.subtype === subtype && d.kind === block.type);
}

export function kindColor(kind: BlockKind): string {
  if (kind === "trigger") return "var(--accent-green)";
  if (kind === "logic") return "var(--state-warning)";
  return "var(--state-info)";
}

let counter = 0;
export function createBlock(definition: BlockDefinition): WorkflowBlock {
  counter += 1;
  const id = `${definition.kind}_${Date.now().toString(36)}_${counter}`;
  const block: WorkflowBlock = {
    id,
    type: definition.kind,
    label: definition.label,
    description: definition.description,
    config: JSON.parse(JSON.stringify(definition.defaultConfig)),
    next: null,
  };
  if (definition.kind === "trigger") block.trigger_type = definition.subtype;
  if (definition.kind === "action") block.action_type = definition.subtype;
  if (definition.kind === "logic") block.logic_type = definition.subtype;
  return block;
    }
