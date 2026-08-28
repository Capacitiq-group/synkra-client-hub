import {
  Bell,
  Braces,
  Building2,
  Clock,
  Database,
  DollarSign,
  FileText,
  Filter,
  GitBranch,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Scissors,
  Hash,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Tags,
  Timer,
  TrendingUp,
  UserPlus,
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
  /** Catalog key of an integration that must be connected before this works. */
  requiresIntegration?: string;
  /**
   * OAuth scopes this block needs on that integration's connection.
   * The block library / config panel diffs this against the
   * connection's granted scopes (integrations.scopes) and prompts a
   * reauthorize flow if anything's missing, instead of letting the
   * block silently fail at run time. See
   * docs/integrations/scopes-and-custom-workflows.md.
   */
  requiredScopes?: string[];
  /**
   * One-line, jargon-free explainer shown under the block title inside the
   * config panel. Written for someone with no technical background.
   */
  configHint?: string;
  /** Extra one-line clarification shown under the description in the config panel. */
  configNote?: string;
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
    configHint: "Starts this workflow when an email is forwarded to your dedicated inbound address.",
    kind: "trigger",
    subtype: "email_received",
    label: "Email received",
    description: "Fires when an email is forwarded to your inbound address",
    icon: Mail,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    defaultConfig: { channel: "resend_inbound", match_all: true },
  },
  {
    key: "slack_message_received",
    configHint: "Starts this workflow whenever someone posts a new message in the Slack channel you pick.",
    kind: "trigger",
    subtype: "slack_message_received",
    label: "New Slack message",
    description: "Fires when a new message is posted in a Slack channel",
    icon: Hash,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    requiresIntegration: "slack",
    defaultConfig: { channel_id: "" },
  },
  {
    key: "slack_unanswered_check",
    configHint: "Starts this workflow when a question in your Slack channel has gone unanswered for too long.",
    kind: "trigger",
    subtype: "slack_unanswered_check",
    label: "Unanswered Slack question",
    description: "Fires when a question in a Slack channel has had no reply",
    icon: Hash,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    requiresIntegration: "slack",
    defaultConfig: { channel_id: "", unanswered_after_hours: 4 },
  },
  {
    key: "slack_daily_digest",
    configHint: "Runs once a day and collects that day's messages from the Slack channel you pick.",
    kind: "trigger",
    subtype: "slack_daily_digest",
    label: "Daily Slack digest",
    description: "Runs once a day over a Slack channel's messages",
    icon: Hash,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    requiresIntegration: "slack",
    defaultConfig: { channel_id: "" },
  },
  {
    key: "hubspot_new_contact",
    configHint: "Starts this workflow whenever a new contact is created in HubSpot.",
    kind: "trigger",
    subtype: "hubspot_event",
    label: "New HubSpot contact",
    description: "Fires when a contact is created in HubSpot",
    icon: Building2,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.contacts.read"],
    defaultConfig: { subscription_type: "contact.creation", match_all: true },
  },
  {
    key: "hubspot_deal_stage_changed",
    configHint: "Starts this workflow when a deal moves to the pipeline stage you pick.",
    kind: "trigger",
    subtype: "hubspot_event",
    label: "Deal stage changed",
    description: "Fires when a HubSpot deal's stage is updated",
    icon: TrendingUp,
    color: "var(--accent-green)",
    section: "TRIGGERS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.deals.read"],
    // match_all: false + a variable/operator/value condition is exactly
    // the evaluate_condition() shape hubspot_webhook.py already uses for
    // filter/if_else — "trigger.dealstage" is the changed deal's new
    // stage on the enriched event payload.
    defaultConfig: {
      subscription_type: "deal.propertyChange",
      match_all: false,
      variable: "trigger.dealstage",
      operator: "equals",
      value: "",
    },
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
    configHint: "Looks up something you saved earlier and brings it into this workflow.",
    configNote:
      "Looks up records your own workflows saved earlier with a 'Save information' step in the same Collection — not your email or any external data.",
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
    defaultConfig: { to: "", body: "" },
  },
  {
    key: "classify_message_ai",
    configHint: "Reads a message and puts it into one of the categories you list, so later steps can act on the result.",
    kind: "action",
    subtype: "classify_message_ai",
    label: "Classify with AI",
    description: "Sorts a message into categories you define",
    icon: Tags,
    color: "#8B5CF6",
    section: "ACTIONS",
    usesCredits: true,
    defaultConfig: { message: "", categories: [], output_variable: "classification" },
  },
  {
    key: "send_notification",
    configHint: "Puts a notification in your Synkra dashboard, so you see it next time you are in the app.",
    kind: "action",
    subtype: "send_notification",
    label: "Send in-app notification",
    description: "Creates a notification inside the Synkra dashboard",
    icon: Bell,
    color: "var(--state-info)",
    section: "ACTIONS",
    defaultConfig: { title: "", body: "", link: "" },
  },
  {
    key: "hubspot_find_contact",
    configHint: "Looks up an existing HubSpot contact by email — useful before deciding whether to create or update one.",
    kind: "action",
    subtype: "hubspot_find_contact",
    label: "Find HubSpot contact",
    description: "Looks up a HubSpot contact by email",
    icon: Building2,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.contacts.read"],
    defaultConfig: { email: "", output_variable: "hubspot_contact" },
  },
  {
    key: "hubspot_create_contact",
    configHint: "Creates a new contact in HubSpot with the details you fill in.",
    kind: "action",
    subtype: "hubspot_create_contact",
    label: "Create HubSpot contact",
    description: "Creates a new contact in HubSpot",
    icon: UserPlus,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.contacts.write"],
    defaultConfig: { properties: { email: "" }, output_variable: "hubspot_contact" },
  },
  {
    key: "hubspot_update_contact",
    configHint: "Updates fields on an existing HubSpot contact.",
    kind: "action",
    subtype: "hubspot_update_contact",
    label: "Update HubSpot contact",
    description: "Updates an existing HubSpot contact's details",
    icon: Building2,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.contacts.write"],
    defaultConfig: { contact_id: "", properties: {}, output_variable: "hubspot_contact" },
  },
  {
    key: "hubspot_find_deal",
    configHint: "Looks up an existing HubSpot deal by name.",
    kind: "action",
    subtype: "hubspot_find_deal",
    label: "Find HubSpot deal",
    description: "Looks up a HubSpot deal by name",
    icon: TrendingUp,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.deals.read"],
    defaultConfig: { deal_name: "", output_variable: "hubspot_deal" },
  },
  {
    key: "hubspot_create_deal",
    configHint: "Creates a new deal in HubSpot — set the pipeline and stage you want it to start in.",
    kind: "action",
    subtype: "hubspot_create_deal",
    label: "Create HubSpot deal",
    description: "Creates a new deal in HubSpot",
    icon: TrendingUp,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.deals.write"],
    defaultConfig: { properties: { dealname: "" }, output_variable: "hubspot_deal" },
  },
  {
    key: "hubspot_update_deal",
    configHint: "Updates fields on an existing HubSpot deal — e.g. moving it to a new stage.",
    kind: "action",
    subtype: "hubspot_update_deal",
    label: "Update HubSpot deal",
    description: "Updates an existing HubSpot deal's details",
    icon: TrendingUp,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.deals.write"],
    defaultConfig: { deal_id: "", properties: {}, output_variable: "hubspot_deal" },
  },
  {
    key: "hubspot_add_note",
    configHint: "Logs a note on a HubSpot contact's timeline.",
    kind: "action",
    subtype: "hubspot_add_note",
    label: "Add HubSpot note",
    description: "Adds a note to a HubSpot contact's timeline",
    icon: FileText,
    color: "#FF7A59",
    section: "ACTIONS",
    requiresIntegration: "hubspot",
    requiredScopes: ["crm.objects.contacts.write"],
    defaultConfig: { contact_id: "", note_body: "" },
  },
  {
    key: "send_slack_message",
    configHint: "Posts a message to a Slack channel — pick the channel and write the message, using variables from earlier in the workflow if you like.",
    kind: "action",
    subtype: "send_slack_message",
    label: "Send Slack message",
    description: "Posts a message to a Slack channel",
    icon: Hash,
    color: "#E01E5A",
    section: "ACTIONS",
    requiresIntegration: "slack",
    requiredScopes: ["chat:write"],
    defaultConfig: { channel_id: "", text: "" },
  },
  {
    key: "zoho_find_contact",
    configHint: "Looks up an existing Zoho Books contact by email — useful before deciding whether to create or update one.",
    kind: "action",
    subtype: "zoho_find_contact",
    label: "Find Zoho contact",
    description: "Looks up a Zoho Books contact by email",
    icon: DollarSign,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.contacts.READ"],
    defaultConfig: { email: "", output_variable: "zoho_contact" },
  },
  {
    key: "zoho_create_contact",
    configHint: "Creates a new customer or vendor contact in Zoho Books.",
    kind: "action",
    subtype: "zoho_create_contact",
    label: "Create Zoho contact",
    description: "Creates a new contact in Zoho Books",
    icon: UserPlus,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.contacts.CREATE"],
    defaultConfig: { fields: { contact_name: "" }, output_variable: "zoho_contact" },
  },
  {
    key: "zoho_update_contact",
    configHint: "Updates fields on an existing Zoho Books contact.",
    kind: "action",
    subtype: "zoho_update_contact",
    label: "Update Zoho contact",
    description: "Updates an existing Zoho Books contact's details",
    icon: DollarSign,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.contacts.UPDATE"],
    defaultConfig: { contact_id: "", fields: {} },
  },
  {
    key: "zoho_find_invoice",
    configHint: "Looks up an existing Zoho Books invoice by invoice number.",
    kind: "action",
    subtype: "zoho_find_invoice",
    label: "Find Zoho invoice",
    description: "Looks up a Zoho Books invoice by number",
    icon: FileText,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.invoices.READ"],
    defaultConfig: { invoice_number: "", output_variable: "zoho_invoice" },
  },
  {
    key: "zoho_create_invoice",
    configHint: "Creates a new invoice in Zoho Books for a customer.",
    kind: "action",
    subtype: "zoho_create_invoice",
    label: "Create Zoho invoice",
    description: "Creates a new invoice in Zoho Books",
    icon: FileText,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.invoices.CREATE"],
    defaultConfig: { fields: { customer_id: "", line_items: [] }, output_variable: "zoho_invoice" },
  },
  {
    key: "zoho_add_invoice_comment",
    configHint: "Adds an internal comment to a Zoho Books invoice's activity log — not visible to the customer.",
    kind: "action",
    subtype: "zoho_add_invoice_comment",
    label: "Add Zoho invoice comment",
    description: "Adds an internal comment to a Zoho Books invoice",
    icon: FileText,
    color: "#E42527",
    section: "ACTIONS",
    requiresIntegration: "zoho",
    requiredScopes: ["ZohoBooks.invoices.UPDATE"],
    defaultConfig: { invoice_id: "", comment: "" },
  },
  {
    key: "custom_api_call",
    configHint: "For anything the ready-made blocks above don't cover — call any endpoint on a connected platform directly. If it needs a permission you haven't granted yet, you'll be asked to authorize it.",
    kind: "action",
    subtype: "custom_api_call",
    label: "Custom action",
    description: "Calls any endpoint on a connected platform — not limited to the blocks above",
    icon: Braces,
    color: "var(--text-muted)",
    section: "ACTIONS",
    // No fixed requiresIntegration/requiredScopes — both are chosen per
    // use in the config panel (which platform, which endpoint), and the
    // panel writes the resulting scope requirement onto the block
    // instance's `required_scopes` (WorkflowBlock, not this static
    // definition) rather than here. See
    // docs/integrations/scopes-and-custom-workflows.md.
    defaultConfig: { integration: "", method: "GET", endpoint: "", body: {}, output_variable: "api_response" },
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



    
