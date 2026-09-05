// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
/**
 * Pre-built workflow templates seeded into the PocketBase `workflow_templates`
 * collection, and shown in the onboarding wizard.
 *
 * Seeding is idempotent: each template is matched on `template_id` and updated
 * in place, so re-running setup never creates duplicates.
 */
import type PocketBase from "pocketbase";

export interface SeedTemplateBlock {
  id: string;
  type: "trigger" | "action" | "logic";
  trigger_type?: string;
  action_type?: string;
  logic_type?: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
  next: string | null;
}

export interface SeedTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  requires_paid_api: boolean;
  integrations_required: string[];
  is_active: boolean;
  sort_order: number;
  blocks: SeedTemplateBlock[];
}

export const TEMPLATES: SeedTemplate[] = [
  {
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "webhook",
        "label": "Form submitted",
        "description": "Fires when a contact form or lead form is submitted",
        "config": {
          "path": "/webhooks/lead/{{workspace_id}}",
          "description": "Paste this URL into your website form or Typeform as the submission destination",
          "expected_fields": [
            "name",
            "email",
            "phone",
            "message"
          ]
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "send_email",
        "label": "Email notification to owner",
        "description": "Sends you an email the moment a lead submits their details",
        "config": {
          "to": "{{user.email}}",
          "subject": "New lead from {{payload.name}}",
          "body": "Hi,\n\nA new lead just came in.\n\nName: {{payload.name}}\nEmail: {{payload.email}}\nPhone: {{payload.phone}}\nMessage: {{payload.message}}\n\nReply to this email to follow up.\n\nSynkra"
        },
        "next": null
      }
    ],
    "category": "Sales",
    "description": "When someone submits a form on your website, you get an email immediately with their details.",
    "integrations_required": [
      "email"
    ],
    "is_active": true,
    "name": "New lead notification",
    "requires_paid_api": false,
    "sort_order": 1,
    "template_id": "tpl_lead_notification"
  },
  {
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "schedule",
        "label": "Every day at 7am",
        "description": "Runs automatically every morning at 7am South African time",
        "config": {
          "frequency": "daily",
          "time": "07:00",
          "timezone": "Africa/Johannesburg"
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "send_email",
        "label": "Send digest email",
        "description": "Sends your morning summary to your email address",
        "config": {
          "to": "{{user.email}}",
          "subject": "Your daily business digest",
          "body": "Good morning,\n\nHere is your summary for today.\n\nThis digest runs every day at 7am. You can customise what it includes as your account grows.\n\nSynkra"
        },
        "next": null
      }
    ],
    "category": "Operations",
    "description": "Every morning at 7am you get a summary email of what happened in your business.",
    "integrations_required": [
      "email"
    ],
    "is_active": true,
    "name": "Daily business digest",
    "requires_paid_api": false,
    "sort_order": 2,
    "template_id": "tpl_daily_digest"
  },
  {
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "webhook",
        "label": "Appointment booked",
        "description": "Fires when a new appointment is booked. Send this webhook from your booking system.",
        "config": {
          "path": "/webhooks/appointment/{{workspace_id}}",
          "description": "Fire this webhook when an appointment is booked",
          "expected_fields": [
            "customer_name",
            "customer_email",
            "appointment_datetime"
          ]
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "wait",
        "label": "Wait until 24 hours before",
        "description": "The workflow pauses here and continues 24 hours before the appointment time",
        "config": {
          "wait_until": "{{payload.appointment_datetime}} - 24 hours"
        },
        "next": "action_2"
      },
      {
        "id": "action_2",
        "type": "action",
        "action_type": "send_email",
        "label": "Send reminder email",
        "description": "Sends a friendly reminder to the customer before their appointment",
        "config": {
          "to": "{{payload.customer_email}}",
          "subject": "Reminder: Your appointment tomorrow",
          "body": "Hi {{payload.customer_name}},\n\nThis is a reminder about your appointment scheduled for {{payload.appointment_datetime}}.\n\nIf you need to reschedule please reply to this email as soon as possible.\n\n{{user.business_name}}"
        },
        "next": null
      }
    ],
    "category": "Customer Service",
    "description": "Automatically email your customer a reminder 24 hours before their appointment.",
    "integrations_required": [
      "email"
    ],
    "is_active": true,
    "name": "Appointment reminder",
    "requires_paid_api": false,
    "sort_order": 3,
    "template_id": "tpl_appointment_reminder"
  },
  {
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "webhook",
        "label": "Job completed",
        "description": "Fires when a job or service is marked as complete",
        "config": {
          "path": "/webhooks/job-complete/{{workspace_id}}",
          "description": "Fire this when a job is done",
          "expected_fields": [
            "customer_name",
            "customer_email",
            "review_link"
          ]
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "wait",
        "label": "Wait 24 hours",
        "description": "Gives the customer time to reflect on the experience before asking for a review",
        "config": {
          "duration": 24,
          "unit": "hours"
        },
        "next": "action_2"
      },
      {
        "id": "action_2",
        "type": "action",
        "action_type": "send_email",
        "label": "Send review request",
        "description": "A warm email asking for an honest review with a direct link",
        "config": {
          "to": "{{payload.customer_email}}",
          "subject": "How did we do?",
          "body": "Hi {{payload.customer_name}},\n\nThank you for choosing {{user.business_name}}. We hope everything went well.\n\nIf you have a moment, we would really appreciate a quick review. It helps other customers find us and helps us keep improving.\n\nLeave a review here: {{payload.review_link}}\n\nThank you.\n\n{{user.business_name}}"
        },
        "next": null
      }
    ],
    "category": "Marketing",
    "description": "After a completed job, automatically ask your customer to leave a Google review.",
    "integrations_required": [
      "email"
    ],
    "is_active": true,
    "name": "Review request",
    "requires_paid_api": false,
    "sort_order": 4,
    "template_id": "tpl_review_request"
  },
  {
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "webhook",
        "label": "Invoice created",
        "description": "Fires when an invoice is sent to a customer",
        "config": {
          "path": "/webhooks/invoice/{{workspace_id}}",
          "description": "Fire this when you send an invoice",
          "expected_fields": [
            "customer_name",
            "customer_email",
            "invoice_number",
            "amount",
            "due_date"
          ]
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "wait",
        "label": "Wait until 3 days before due date",
        "description": "Pauses until 3 days before payment is due",
        "config": {
          "wait_until": "{{payload.due_date}} - 3 days"
        },
        "next": "action_2"
      },
      {
        "id": "action_2",
        "type": "action",
        "action_type": "send_email",
        "label": "Send first reminder",
        "description": "A friendly reminder that payment is due soon",
        "config": {
          "to": "{{payload.customer_email}}",
          "subject": "Invoice {{payload.invoice_number}} due in 3 days",
          "body": "Hi {{payload.customer_name}},\n\nThis is a reminder that invoice {{payload.invoice_number}} for R{{payload.amount}} is due in 3 days.\n\nPlease arrange payment at your earliest convenience.\n\n{{user.business_name}}"
        },
        "next": "action_3"
      },
      {
        "id": "action_3",
        "type": "action",
        "action_type": "wait",
        "label": "Wait until 1 day after due date",
        "description": "Pauses until the day after the invoice was due",
        "config": {
          "wait_until": "{{payload.due_date}} + 1 day"
        },
        "next": "action_4"
      },
      {
        "id": "action_4",
        "type": "action",
        "action_type": "send_email",
        "label": "Send overdue notice",
        "description": "A firmer message letting the customer know their invoice is overdue",
        "config": {
          "to": "{{payload.customer_email}}",
          "subject": "Invoice {{payload.invoice_number}} is now overdue",
          "body": "Hi {{payload.customer_name}},\n\nInvoice {{payload.invoice_number}} for R{{payload.amount}} was due yesterday and remains unpaid.\n\nPlease contact us to arrange payment or to discuss your account.\n\n{{user.business_name}}"
        },
        "next": null
      }
    ],
    "category": "Finance",
    "description": "Automatically remind customers about unpaid invoices before and after the due date.",
    "integrations_required": [
      "email"
    ],
    "is_active": true,
    "name": "Invoice payment reminder",
    "requires_paid_api": false,
    "sort_order": 5,
    "template_id": "tpl_invoice_reminder"
  },
  {
    "template_id": "tpl_slack_unanswered_watchdog",
    "name": "Unanswered question watchdog",
    "description": "Watches a Slack channel and notifies you when a genuine question has gone unanswered for too long.",
    "category": "Operations",
    "requires_paid_api": true,
    "integrations_required": [
      "slack"
    ],
    "is_active": true,
    "sort_order": 6,
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "slack_unanswered_check",
        "label": "Unanswered Slack question",
        "description": "Checks a Slack channel for questions nobody has replied to",
        "config": {
          "channel_id": "",
          "unanswered_after_hours": 4
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "send_notification",
        "label": "Notify me in Synkra",
        "description": "Creates a notification inside the Synkra dashboard",
        "config": {
          "title": "Unanswered question in Slack",
          "body": "{{trigger.sender_name}} asked: \"{{trigger.message}}\" — still unanswered after {{trigger.hours_unanswered}} hours.",
          "link": ""
        },
        "next": null
      }
    ]
  },
  {
    "template_id": "tpl_slack_urgent_triage",
    "name": "Urgent message triage",
    "description": "Reads new Slack messages, decides which ones are urgent, and notifies you only about those.",
    "category": "Operations",
    "requires_paid_api": true,
    "integrations_required": [
      "slack"
    ],
    "is_active": true,
    "sort_order": 7,
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "slack_message_received",
        "label": "New Slack message",
        "description": "Fires when a new message is posted in the channel you pick",
        "config": {
          "channel_id": ""
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "classify_message_ai",
        "label": "Classify with AI",
        "description": "Sorts a message into categories you define",
        "config": {
          "message": "{{trigger.message}}",
          "categories": [
            "urgent - needs immediate attention",
            "normal - no action needed"
          ],
          "output_variable": "urgency"
        },
        "next": "logic_1"
      },
      {
        "id": "logic_1",
        "type": "logic",
        "logic_type": "filter",
        "label": "Only continue if urgent",
        "description": "Stops the workflow if the message is not urgent",
        "config": {
          "variable": "urgency",
          "operator": "equals",
          "value": "urgent - needs immediate attention"
        },
        "next": "action_2"
      },
      {
        "id": "action_2",
        "type": "action",
        "action_type": "send_notification",
        "label": "Notify me in Synkra",
        "description": "Creates a notification inside the Synkra dashboard",
        "config": {
          "title": "Urgent Slack message from {{trigger.sender_name}}",
          "body": "{{trigger.message}}",
          "link": ""
        },
        "next": null
      }
    ]
  },
  {
    "template_id": "tpl_slack_end_of_day_digest",
    "name": "Slack end-of-day digest",
    "description": "Once a day, summarises what was said in a Slack channel and drops the summary in your dashboard.",
    "category": "Operations",
    "requires_paid_api": true,
    "integrations_required": [
      "slack"
    ],
    "is_active": true,
    "sort_order": 8,
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "trigger_type": "slack_daily_digest",
        "label": "Daily Slack digest",
        "description": "Runs once a day and collects the day's messages from the channel you pick",
        "config": {
          "channel_id": ""
        },
        "next": "action_1"
      },
      {
        "id": "action_1",
        "type": "action",
        "action_type": "summarise_ai",
        "label": "Summarise the day",
        "description": "Summarises text into a short overview",
        "config": {
          "input": "{{trigger.message}}",
          "max_words": 150,
          "output_variable": "digest_summary"
        },
        "next": "action_2"
      },
      {
        "id": "action_2",
        "type": "action",
        "action_type": "send_notification",
        "label": "Post the digest in Synkra",
        "description": "Creates a notification inside the Synkra dashboard",
        "config": {
          "title": "Your Slack digest",
          "body": "{{digest_summary}}",
          "link": ""
        },
        "next": null
      }
    ]
  },

  // ============================================================
  // Launch integrations — Shopify, Typeform, Tally, Calendly, Xero,
  // Airtable, Monday.com, Asana, Pipedrive. 3 templates each, 27
  // total. See docs/integrations/new-providers.md (backend repo) for
  // the full architecture writeup. Every template below activates
  // as a `draft` workflow like every other template (see
  // useTemplates.ts's activateTemplate()) — the user must explicitly
  // publish it before it runs.
  // ============================================================
  {
    "template_id": "tpl_shopify_catalogue_audit",
    "name": "AI Product Catalogue Audit",
    "description": "Reviews your Shopify product catalogue on a weekly schedule and emails a prioritised report of catalogue-quality issues — weak titles, thin descriptions, missing tags, inconsistent pricing — with specific fixes for each.",
    "category": "Commerce",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "shopify",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Shopify products",
        "description": "Retrieves products and variants from your Shopify store",
        "config": {
          "limit": 250,
          "output_variable": "shopify_products"
        },
        "next": "action_2",
        "action_type": "shopify_list_products"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{shopify_products}}",
          "instructions": "Review this Shopify product catalogue. Identify catalogue-quality problems: weak or unclear titles, thin or duplicate descriptions, missing product types or tags, and inconsistent or suspicious variant pricing. Prioritise the issues by how much they likely hurt discoverability or conversion, most important first. For each priority issue, name the affected product(s) and a specific recommended fix.",
          "report_title": "Product Catalogue Audit",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Your Shopify catalogue audit is ready",
          "body": "Hi,\n\nHere is this week's product catalogue audit.\n\n{{ai_report}}\n\n— Synkra"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 100
  },
  {
    "template_id": "tpl_shopify_inventory_risk",
    "name": "AI Inventory Risk Report",
    "description": "Cross-references current Shopify inventory levels against recent order activity every day and emails a report flagging products at risk of stocking out, and products with excess inventory relative to demand.",
    "category": "Commerce",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "shopify",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "daily",
          "time": "07:00",
          "timezone": "Africa/Johannesburg"
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Shopify inventory levels",
        "description": "Retrieves current inventory levels from Shopify",
        "config": {
          "limit": 250,
          "output_variable": "shopify_inventory"
        },
        "next": "action_2",
        "action_type": "shopify_list_inventory"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Shopify orders",
        "description": "Retrieves recent orders from Shopify",
        "config": {
          "days_back": 30,
          "status": "any",
          "output_variable": "shopify_orders"
        },
        "next": "action_3",
        "action_type": "shopify_list_orders"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "inventory_levels": "{{shopify_inventory}}",
            "recent_orders": "{{shopify_orders}}"
          },
          "instructions": "Cross-reference current inventory levels against recent order volume per product. Identify products at meaningful risk of stocking out soon, products carrying excess inventory relative to demand, and any products with unusually fast-growing demand. Rank by urgency and explain the reasoning for each.",
          "report_title": "Inventory Risk Report",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Shopify inventory risk report",
          "body": "Hi,\n\nHere is today's inventory risk report.\n\n{{ai_report}}\n\n— Synkra"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 101
  },
  {
    "template_id": "tpl_shopify_customer_value",
    "name": "AI Customer Value Review",
    "description": "Reviews your Shopify customer list weekly and emails a report classifying customers as high value, growing, declining, or inactive, highlighting your best customers and any who look like they're churning.",
    "category": "Commerce",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "shopify",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Shopify customers",
        "description": "Retrieves customers from Shopify",
        "config": {
          "limit": 250,
          "output_variable": "shopify_customers"
        },
        "next": "action_2",
        "action_type": "shopify_list_customers"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{shopify_customers}}",
          "instructions": "Using each customer's order count, total spend, and recency, classify customers into: high value, growing, declining, or inactive, explaining the reasoning behind each classification. Highlight the highest-value customers by name and any customers who look like they're churning.",
          "report_title": "Customer Value Review",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Shopify customer value review",
          "body": "Hi,\n\nHere is this week's customer value review.\n\n{{ai_report}}\n\n— Synkra"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 102
  },
  {
    "template_id": "tpl_typeform_response_qualification",
    "name": "AI Response Qualification",
    "description": "Runs automatically on every new response to a Typeform you pick. AI scores and qualifies the response against your criteria and emails the result — intent, urgency, key requirements, and a recommended next action.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "typeform",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "New Typeform response",
        "description": "Fires when the selected Typeform receives a new response",
        "config": {
          "form_id": ""
        },
        "next": "action_1",
        "trigger_type": "typeform_response_received"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Typeform response",
        "description": "Retrieves the complete answers for the new response",
        "config": {
          "form_id": "{{payload.form_response.form_id}}",
          "response_id": "{{payload.form_response.token}}",
          "output_variable": "typeform_response"
        },
        "next": "action_2",
        "action_type": "typeform_get_response"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{typeform_response}}",
          "instructions": "Qualify this form response against a good-fit lead or request. Produce a qualification score out of 100, the respondent's likely intent, urgency, key requirements mentioned, and a recommended next action. Say plainly if the response doesn't contain enough detail to be confident.",
          "report_title": "Response Qualification",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "New Typeform response — qualification result",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 110
  },
  {
    "template_id": "tpl_typeform_feedback_digest",
    "name": "AI Feedback Digest",
    "description": "Pulls a Typeform's responses over the past week and emails a digest grouping them into recurring themes, overall sentiment, and the most frequently mentioned issues or requests.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "typeform",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Typeform responses",
        "description": "Retrieves responses to the selected form since the last digest",
        "config": {
          "form_id": "",
          "since": "",
          "until": "",
          "output_variable": "typeform_responses"
        },
        "next": "action_2",
        "action_type": "typeform_get_responses"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{typeform_responses}}",
          "instructions": "Group these Typeform responses into recurring themes. Identify overall sentiment, recurring problems or requests, and the most frequently mentioned issues. Present the digest with the most important patterns first, not just a list of individual responses.",
          "report_title": "Feedback Digest",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Your Typeform feedback digest",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 111
  },
  {
    "template_id": "tpl_typeform_application_review",
    "name": "AI Application/Request Review",
    "description": "Runs automatically on every new response to an application or request Typeform. AI checks whether the required information was provided and produces either a clarification request or an internal review brief.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "typeform",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "New Typeform response",
        "description": "Fires when the selected Typeform receives a new response",
        "config": {
          "form_id": ""
        },
        "next": "action_1",
        "trigger_type": "typeform_response_received"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Typeform response",
        "description": "Retrieves the complete answers for the new response",
        "config": {
          "form_id": "{{payload.form_response.form_id}}",
          "response_id": "{{payload.form_response.token}}",
          "output_variable": "typeform_response"
        },
        "next": "action_2",
        "action_type": "typeform_get_response"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Check completeness",
        "description": "Classifies whether required information is missing from the response",
        "config": {
          "message": "{{typeform_response}}",
          "categories": [
            "missing_information",
            "sufficient_information"
          ],
          "output_variable": "application_status"
        },
        "next": "action_3",
        "action_type": "classify_message_ai"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "response": "{{typeform_response}}",
            "completeness": "{{application_status}}"
          },
          "instructions": "If completeness is 'missing_information', draft a warm, specific clarification request addressed to the applicant, asking for exactly what's missing. If completeness is 'sufficient_information', draft an internal review brief instead, covering: applicant profile, stated requirements, relevant information provided, any risks, and residual gaps. Draft only the one that applies — do not produce both. NOTE: this workflow builder currently runs one linear path rather than true either/or branching to two different recipients, so both cases are drafted here and sent to the same recipient below; split this into two workflows with a Filter block if you need the clarification request to go to the applicant directly.",
          "report_title": "Application Review",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Application review — {{application_status}}",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 112
  },
  {
    "template_id": "tpl_tally_submission_qualification",
    "name": "AI Submission Qualification",
    "description": "Runs automatically on every new submission to a Tally form you pick. AI scores and classifies the submission against your criteria and emails the result.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "tally",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "New Tally submission",
        "description": "Fires when the selected Tally form receives a new submission",
        "config": {
          "form_id": ""
        },
        "next": "action_1",
        "trigger_type": "tally_submission_received"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Tally submission",
        "description": "Retrieves the complete answers for the new submission",
        "config": {
          "form_id": "{{payload.data.formId}}",
          "submission_id": "{{payload.data.submissionId}}",
          "output_variable": "tally_submission"
        },
        "next": "action_2",
        "action_type": "tally_get_submission"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{tally_submission}}",
          "instructions": "Score and classify this Tally submission against the criteria a business would care about for this kind of form (fit, urgency, completeness). Extract the key requirements and concerns mentioned. State the score or classification clearly at the top of the report.",
          "report_title": "Submission Qualification",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "New Tally submission — qualification result",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 120
  },
  {
    "template_id": "tpl_tally_application_screening",
    "name": "AI Application Screening",
    "description": "Runs automatically on every new submission to an application-style Tally form. AI produces strengths, concerns, missing information, and a recommended review priority — decision support for a human reviewer, not an automatic accept or reject.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "tally",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "New Tally submission",
        "description": "Fires when the selected Tally form receives a new submission",
        "config": {
          "form_id": ""
        },
        "next": "action_1",
        "trigger_type": "tally_submission_received"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Tally submission",
        "description": "Retrieves the complete answers for the new submission",
        "config": {
          "form_id": "{{payload.data.formId}}",
          "submission_id": "{{payload.data.submissionId}}",
          "output_variable": "tally_submission"
        },
        "next": "action_2",
        "action_type": "tally_get_submission"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{tally_submission}}",
          "instructions": "Evaluate this application against reasonable general criteria (fit, completeness, apparent risk). Produce: strengths, concerns, missing information, and a recommended review priority (low, medium, or high). This is decision support only — do not phrase it as an accept or reject decision; a human reviewer makes that call.",
          "report_title": "Application Screening",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Application to review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 121
  },
  {
    "template_id": "tpl_tally_feedback_research_digest",
    "name": "AI Feedback & Research Digest",
    "description": "Pulls a Tally form's submissions over the past week and emails a digest identifying recurring themes and simple response metrics — useful for feedback forms, surveys, or research intake forms.",
    "category": "Forms",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "tally",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Tally submissions",
        "description": "Retrieves submissions to the selected form since the last digest",
        "config": {
          "form_id": "",
          "since": "",
          "output_variable": "tally_submissions"
        },
        "next": "action_2",
        "action_type": "tally_get_submissions"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{tally_submissions}}",
          "instructions": "Group these submissions' qualitative answers into recurring themes. Identify recurring complaints, requests, and positive feedback, and any simple response metrics worth noting (e.g. how many responses, the most common theme). Summarise as an executive digest, most important first.",
          "report_title": "Feedback & Research Digest",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Your Tally feedback & research digest",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 122
  },
  {
    "template_id": "tpl_calendly_meeting_debrief",
    "name": "AI Meeting Debrief",
    "description": "Runs automatically when a Calendly meeting completes. AI summarises the meeting using the invitee details and any available recap — decisions, action items, open questions, recommended follow-up — and emails it to you.",
    "category": "Scheduling",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "calendly",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Calendly meeting completed",
        "description": "Fires when a scheduled Calendly meeting finishes",
        "config": {
          "event_type_uri": ""
        },
        "next": "action_1",
        "trigger_type": "calendly_meeting_completed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Calendly invitees",
        "description": "Retrieves the invitees for this meeting",
        "config": {
          "event_uuid": "{{payload.payload.uuid}}",
          "output_variable": "calendly_invitees"
        },
        "next": "action_2",
        "action_type": "calendly_get_event_invitees"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Calendly meeting recap",
        "description": "Retrieves the recap or notes for this meeting, if available",
        "config": {
          "event_uuid": "{{payload.payload.uuid}}",
          "output_variable": "calendly_recap"
        },
        "next": "action_3",
        "action_type": "calendly_get_meeting_recap"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "invitees": "{{calendly_invitees}}",
            "recap": "{{calendly_recap}}"
          },
          "instructions": "Using the invitee details and any available meeting recap or notes, produce: a summary of the meeting, decisions made, action items, unresolved questions, and recommended follow-up. If no recap is available, say so plainly and base the summary on what is available.",
          "report_title": "Meeting Debrief",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Meeting debrief ready",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 130
  },
  {
    "template_id": "tpl_calendly_no_show_followup",
    "name": "AI No-Show Follow-Up",
    "description": "Runs automatically when a Calendly invitee is marked a no-show. AI drafts a personalised rescheduling message, sent to your inbox to review and forward.",
    "category": "Scheduling",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "calendly",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Calendly no-show",
        "description": "Fires when a Calendly invitee is marked a no-show",
        "config": {
          "event_type_uri": ""
        },
        "next": "action_1",
        "trigger_type": "calendly_no_show"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Calendly invitees",
        "description": "Retrieves the invitee who no-showed",
        "config": {
          "event_uuid": "{{payload.payload.uuid}}",
          "output_variable": "calendly_invitees"
        },
        "next": "action_2",
        "action_type": "calendly_get_event_invitees"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{calendly_invitees}}",
          "instructions": "Draft a warm, appropriately brief rescheduling message for the invitee who missed this meeting — easy to reply to, no guilt-tripping. Separately, include a one-line internal note about the no-show for the record.",
          "report_title": "No-Show Follow-Up Draft",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "No-show follow-up drafted — review before sending",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 131
  },
  {
    "template_id": "tpl_calendly_meeting_intelligence",
    "name": "AI Meeting Intelligence Report",
    "description": "Reviews the past week's Calendly meetings and emails a management report identifying recurring topics, questions, objections, and action items across meetings — not just a summary of any one meeting.",
    "category": "Scheduling",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "calendly",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Calendly events",
        "description": "Retrieves this week's scheduled Calendly meetings",
        "config": {
          "org_uri": "",
          "min_start_time": "",
          "max_start_time": "",
          "status": "active",
          "output_variable": "calendly_events"
        },
        "next": "action_2",
        "action_type": "calendly_list_scheduled_events"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{calendly_events}}",
          "instructions": "Across these meetings, identify recurring topics, questions, objections, requested features or services, and any patterns worth flagging to management. Look for patterns across meetings, not just a per-meeting summary.",
          "report_title": "Meeting Intelligence Report",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly meeting intelligence report",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 132
  },
  {
    "template_id": "tpl_xero_receivables_risk",
    "name": "AI Receivables Risk Report",
    "description": "Reviews outstanding Xero invoices against payment history every week and emails a prioritised report of collection risk, ageing concerns, and customers who need attention.",
    "category": "Finance",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "xero",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Xero invoices",
        "description": "Retrieves outstanding invoices from Xero",
        "config": {
          "statuses": [
            "AUTHORISED"
          ],
          "output_variable": "xero_invoices"
        },
        "next": "action_2",
        "action_type": "xero_list_invoices"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Xero payments",
        "description": "Retrieves recent payments from Xero",
        "config": {
          "output_variable": "xero_payments"
        },
        "next": "action_3",
        "action_type": "xero_list_payments"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Get Xero contacts",
        "description": "Retrieves contacts from Xero",
        "config": {
          "output_variable": "xero_contacts"
        },
        "next": "action_4",
        "action_type": "xero_list_contacts"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "outstanding_invoices": "{{xero_invoices}}",
            "payments": "{{xero_payments}}",
            "contacts": "{{xero_contacts}}"
          },
          "instructions": "Analyse outstanding invoice balances against payment history per customer. Identify high-risk receivables, ageing concerns, customers who need proactive attention, and any concentration risk (too much owed by too few customers). Produce prioritised collection recommendations, most urgent first.",
          "report_title": "Receivables Risk Report",
          "output_variable": "ai_report"
        },
        "next": "action_5",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_5",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly receivables risk report",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 140
  },
  {
    "template_id": "tpl_xero_invoice_review",
    "name": "AI Invoice Review",
    "description": "Runs automatically when an invoice is created or updated in Xero. AI checks it against sensible business rules and flags anomalies — unusual amounts, missing details, or unusual terms.",
    "category": "Finance",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "xero",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Xero invoice created or updated",
        "description": "Fires when a Xero invoice is created or updated",
        "config": {},
        "next": "action_1",
        "trigger_type": "xero_invoice_changed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Xero invoice",
        "description": "Retrieves the invoice that changed",
        "config": {
          "invoice_id": "{{payload.events.0.resourceId}}",
          "output_variable": "xero_invoice"
        },
        "next": "action_2",
        "action_type": "xero_get_invoice"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Xero contacts",
        "description": "Retrieves contacts for context on the invoice's customer",
        "config": {
          "output_variable": "xero_contacts"
        },
        "next": "action_3",
        "action_type": "xero_list_contacts"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "invoice": "{{xero_invoice}}",
            "contacts": "{{xero_contacts}}"
          },
          "instructions": "Check this invoice for anomalies: does the amount look unusually large relative to this contact's typical activity, are there unusual line items, is anything obviously missing (dates, reference, contact details), or are the payment terms unusual? Identify anomalies plainly, or state clearly that nothing unusual was found.",
          "report_title": "Invoice Review",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Xero invoice review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 141
  },
  {
    "template_id": "tpl_xero_customer_payment_behaviour",
    "name": "AI Customer Payment Behaviour Report",
    "description": "Reviews invoice and payment history grouped by customer every week and emails a management report on payment timing, consistency, and late-payment patterns per customer.",
    "category": "Finance",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "xero",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Xero invoices",
        "description": "Retrieves invoices from Xero",
        "config": {
          "statuses": [
            "PAID",
            "AUTHORISED"
          ],
          "output_variable": "xero_invoices"
        },
        "next": "action_2",
        "action_type": "xero_list_invoices"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Xero payments",
        "description": "Retrieves payments from Xero",
        "config": {
          "output_variable": "xero_payments"
        },
        "next": "action_3",
        "action_type": "xero_list_payments"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Get Xero contacts",
        "description": "Retrieves contacts from Xero",
        "config": {
          "output_variable": "xero_contacts"
        },
        "next": "action_4",
        "action_type": "xero_list_contacts"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "invoices": "{{xero_invoices}}",
            "payments": "{{xero_payments}}",
            "contacts": "{{xero_contacts}}"
          },
          "instructions": "Group invoice and payment activity by customer. Analyse average payment timing, outstanding amounts, payment consistency, and any late-payment patterns per customer. Produce customer-level risk summaries followed by an overall management summary.",
          "report_title": "Customer Payment Behaviour Report",
          "output_variable": "ai_report"
        },
        "next": "action_5",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_5",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Customer payment behaviour report",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 142
  },
  {
    "template_id": "tpl_airtable_data_quality_audit",
    "name": "AI Data Quality Audit",
    "description": "Reviews a base's records against its schema every week and emails a prioritised report of inconsistent data, suspicious duplicates, and incomplete records.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "airtable",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Airtable base schema",
        "description": "Retrieves the base's tables and field definitions",
        "config": {
          "base_id": "",
          "output_variable": "airtable_schema"
        },
        "next": "action_2",
        "action_type": "airtable_get_base_schema"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Airtable records",
        "description": "Retrieves records from the selected table",
        "config": {
          "base_id": "",
          "table": "",
          "view": "",
          "max_records": 500,
          "output_variable": "airtable_records"
        },
        "next": "action_3",
        "action_type": "airtable_list_records"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "schema": "{{airtable_schema}}",
            "records": "{{airtable_records}}"
          },
          "instructions": "Using the field definitions and the records, identify inconsistent information, suspicious duplicates, incomplete records, conflicting values, and unusual patterns. Produce a prioritised data-quality report, most important issues first.",
          "report_title": "Data Quality Audit",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Airtable data quality audit",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 150
  },
  {
    "template_id": "tpl_airtable_record_review_escalation",
    "name": "AI Record Review & Escalation",
    "description": "Runs automatically when a record is created or updated in a table you pick. AI reviews it, writes the review summary back onto the record, and emails you only if it's high priority.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "airtable",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Airtable record created or updated",
        "description": "Fires when a record in the selected table changes",
        "config": {
          "base_id": "",
          "table": ""
        },
        "next": "action_1",
        "trigger_type": "airtable_record_changed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Airtable record",
        "description": "Retrieves the record that changed",
        "config": {
          "base_id": "",
          "table": "",
          "filter_by_formula": "RECORD_ID()='{{payload.recordId}}'",
          "max_records": 5,
          "output_variable": "airtable_records"
        },
        "next": "action_2",
        "action_type": "airtable_list_records"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Check review priority",
        "description": "Classifies whether this record needs human attention",
        "config": {
          "message": "{{airtable_records}}",
          "categories": [
            "needs_human_attention",
            "no_action_needed"
          ],
          "output_variable": "review_priority"
        },
        "next": "action_3",
        "action_type": "classify_message_ai"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{airtable_records}}",
          "instructions": "Write a short issue summary, a priority (low, medium, or high), and a recommended action for this record, for a human reviewer.",
          "report_title": "Record Review",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Write review back to Airtable",
        "description": "Writes the review summary back onto the record (always runs, regardless of priority)",
        "config": {
          "base_id": "",
          "table": "",
          "record_id": "{{payload.recordId}}",
          "fields": {
            "Review Summary": "{{ai_report}}"
          },
          "output_variable": "airtable_update_result"
        },
        "next": "logic_1",
        "action_type": "airtable_update_record"
      },
      {
        "id": "logic_1",
        "type": "logic",
        "label": "Only continue if high priority",
        "description": "Stops here unless the record needs human attention",
        "config": {
          "variable": "review_priority",
          "operator": "equals",
          "value": "needs_human_attention"
        },
        "next": "action_5",
        "action_type": "filter"
      },
      {
        "id": "action_5",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Airtable record needs review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 151
  },
  {
    "template_id": "tpl_airtable_base_health_report",
    "name": "AI Base Health Report",
    "description": "Reviews a base's records every week and emails an operational summary — unfinished work, stale records, missing fields, and bottlenecks.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "airtable",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Airtable base schema",
        "description": "Retrieves the base's tables and field definitions",
        "config": {
          "base_id": "",
          "output_variable": "airtable_schema"
        },
        "next": "action_2",
        "action_type": "airtable_get_base_schema"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Airtable records",
        "description": "Retrieves records from the selected table",
        "config": {
          "base_id": "",
          "table": "",
          "view": "",
          "max_records": 1000,
          "output_variable": "airtable_records"
        },
        "next": "action_3",
        "action_type": "airtable_list_records"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "schema": "{{airtable_schema}}",
            "records": "{{airtable_records}}"
          },
          "instructions": "Identify unfinished work, stale records (not updated in a long time, if a last-modified field exists), missing required fields, unusual changes, and likely bottlenecks. Produce an operational summary for the base owner.",
          "report_title": "Base Health Report",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly Airtable base health report",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 152
  },
  {
    "template_id": "tpl_monday_project_health_report",
    "name": "AI Project Health Report",
    "description": "Reviews a Monday.com board every week — statuses, dates, owners, and recent updates — and emails a management summary of blocked work, overdue work, and emerging risks.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "monday",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Monday.com board items",
        "description": "Retrieves items, statuses, and updates from the selected board",
        "config": {
          "board_id": "",
          "limit": 200,
          "output_variable": "monday_items"
        },
        "next": "action_2",
        "action_type": "monday_get_board_items"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Monday.com users",
        "description": "Retrieves users to give the AI step names for item owners",
        "config": {
          "output_variable": "monday_users"
        },
        "next": "action_3",
        "action_type": "monday_list_users"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "items": "{{monday_items}}",
            "users": "{{monday_users}}"
          },
          "instructions": "Analyse these board items' statuses, dates, owners, and recent updates. Identify blocked work, overdue work, emerging risks, and unresolved issues. Produce a management summary.",
          "report_title": "Project Health Report",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly project health report",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 160
  },
  {
    "template_id": "tpl_monday_workload_risk_review",
    "name": "AI Workload Risk Review",
    "description": "Reviews a Monday.com board every week and emails a report grouping work by team member, flagging deadline and workload risk per person.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "monday",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "08:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Monday.com board items",
        "description": "Retrieves items, statuses, and updates from the selected board",
        "config": {
          "board_id": "",
          "limit": 200,
          "output_variable": "monday_items"
        },
        "next": "action_2",
        "action_type": "monday_get_board_items"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Monday.com users",
        "description": "Retrieves users to group work by team member",
        "config": {
          "output_variable": "monday_users"
        },
        "next": "action_3",
        "action_type": "monday_list_users"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "items": "{{monday_items}}",
            "users": "{{monday_users}}"
          },
          "instructions": "Group assigned work by team member using the item owners. Identify workload and deadline risk per person: too much work due at once, overdue items piling up, or an unusually light load that might indicate a blocked or stalled person. Produce recommendations per person or team.",
          "report_title": "Workload Risk Review",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly workload risk review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 161
  },
  {
    "template_id": "tpl_monday_blocker_escalation",
    "name": "AI Blocker Escalation",
    "description": "Runs automatically when an item or update changes on a board you pick. AI classifies whether the change looks like a blocker and, if so, emails a concise escalation summary.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "monday",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Monday.com item or update changed",
        "description": "Fires when an item or update changes on the selected board",
        "config": {
          "board_id": ""
        },
        "next": "action_1",
        "trigger_type": "monday_item_changed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Classify severity",
        "description": "Determines whether this change indicates a blocker, and how severe",
        "config": {
          "message": "{{payload}}",
          "categories": [
            "not_a_blocker",
            "minor_blocker",
            "major_blocker",
            "critical_blocker"
          ],
          "output_variable": "blocker_severity"
        },
        "next": "logic_1",
        "action_type": "classify_message_ai"
      },
      {
        "id": "logic_1",
        "type": "logic",
        "label": "Only continue if it's a blocker",
        "description": "Stops here if the change is not a blocker",
        "config": {
          "variable": "blocker_severity",
          "operator": "not_equals",
          "value": "not_a_blocker"
        },
        "next": "action_2",
        "action_type": "filter"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{payload}}",
          "instructions": "Write a concise escalation summary of this item/update change: what changed, why it looks like a blocker, and who should act.",
          "report_title": "Blocker Escalation",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Monday.com blocker escalation — {{blocker_severity}}",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 162
  },
  {
    "template_id": "tpl_asana_project_risk_review",
    "name": "AI Project Risk Review",
    "description": "Reviews an Asana project's tasks every week — due dates, dependencies, status — and emails a project health report identifying risks, blockers, and overdue work.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "asana",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Asana project tasks",
        "description": "Retrieves tasks from the selected project",
        "config": {
          "project_gid": "",
          "only_incomplete": true,
          "output_variable": "asana_tasks"
        },
        "next": "action_2",
        "action_type": "asana_list_project_tasks"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{asana_tasks}}",
          "instructions": "Analyse these tasks' due dates, dependencies, and status. Identify risks, blockers, overdue work, and unresolved dependencies. Produce a project health report for the project owner.",
          "report_title": "Project Risk Review",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly project risk review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 170
  },
  {
    "template_id": "tpl_asana_task_handoff_brief",
    "name": "AI Task Handoff Brief",
    "description": "Runs automatically when a task moves into a stage you pick (e.g. 'Ready for Handoff'). AI reads the task's comment history and drafts a handoff brief for whoever picks it up next.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "asana",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Asana task reaches a stage",
        "description": "Fires when a task moves into the selected section",
        "config": {
          "project_gid": "",
          "section_name": ""
        },
        "next": "action_1",
        "trigger_type": "asana_task_stage_changed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Asana task comments",
        "description": "Retrieves the comment and activity history for the task",
        "config": {
          "task_gid": "{{payload.events.0.resource.gid}}",
          "output_variable": "asana_stories"
        },
        "next": "action_2",
        "action_type": "asana_get_task_stories"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "stories": "{{asana_stories}}"
          },
          "instructions": "Using this task's comment and activity history, write a handoff brief: objective, current state, completed work, outstanding work, risks, and the next action. Write it for the next person taking this over, not for whoever was doing it before.",
          "report_title": "Task Handoff Brief",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Task handoff brief ready",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 171
  },
  {
    "template_id": "tpl_asana_overdue_work_triage",
    "name": "AI Overdue Work Triage",
    "description": "Checks an Asana workspace every day for overdue, incomplete tasks and emails a prioritised triage report categorising the likely reason for each delay with a recommended next action.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "asana",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "daily",
          "time": "07:00",
          "timezone": "Africa/Johannesburg"
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get overdue Asana tasks",
        "description": "Retrieves overdue, incomplete tasks from the workspace",
        "config": {
          "workspace_gid": "",
          "assignee_gid": "",
          "output_variable": "asana_overdue_tasks"
        },
        "next": "action_2",
        "action_type": "asana_list_overdue_tasks"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{asana_overdue_tasks}}",
          "instructions": "For each overdue task, categorise the likely reason for delay: blocked, unclear requirements, dependency, insufficient priority, inactive, or needs escalation. Recommend a next action for each. Produce a prioritised overdue-work report, most urgent first.",
          "report_title": "Overdue Work Triage",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Daily overdue work triage",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 172
  },
  {
    "template_id": "tpl_pipedrive_deal_health_review",
    "name": "AI Deal Health Review",
    "description": "Runs automatically when a deal you're tracking is updated in Pipedrive. AI reviews recent activity and notes to assess momentum and risk, and emails a deal-health assessment.",
    "category": "Sales",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "pipedrive",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Pipedrive deal updated",
        "description": "Fires when a Pipedrive deal is updated",
        "config": {},
        "next": "action_1",
        "trigger_type": "pipedrive_deal_changed"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Pipedrive deal",
        "description": "Retrieves the deal that changed",
        "config": {
          "deal_id": "{{payload.current.id}}",
          "output_variable": "pipedrive_deal"
        },
        "next": "action_2",
        "action_type": "pipedrive_get_deal"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get Pipedrive deal activities",
        "description": "Retrieves activities logged against the deal",
        "config": {
          "deal_id": "{{payload.current.id}}",
          "output_variable": "pipedrive_activities"
        },
        "next": "action_3",
        "action_type": "pipedrive_list_deal_activities"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Get Pipedrive deal notes",
        "description": "Retrieves notes logged against the deal",
        "config": {
          "deal_id": "{{payload.current.id}}",
          "output_variable": "pipedrive_notes"
        },
        "next": "action_4",
        "action_type": "pipedrive_list_deal_notes"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "deal": "{{pipedrive_deal}}",
            "activities": "{{pipedrive_activities}}",
            "notes": "{{pipedrive_notes}}"
          },
          "instructions": "Assess this deal's momentum: recent activity, signs of inactivity, risks, missing next steps, and likelihood of stalling. Produce a deal-health assessment for the salesperson.",
          "report_title": "Deal Health Review",
          "output_variable": "ai_report"
        },
        "next": "action_5",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_5",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Deal health review",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 180
  },
  {
    "template_id": "tpl_pipedrive_sales_call_brief",
    "name": "AI Sales Call Brief",
    "description": "Checks Pipedrive every morning for activities scheduled that day and emails a call brief for each, using whatever deal and contact context is available to suggest talking points.",
    "category": "Sales",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "pipedrive",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "daily",
          "time": "07:00",
          "timezone": "Africa/Johannesburg"
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get upcoming Pipedrive activities",
        "description": "Retrieves activities scheduled for today that aren't done yet",
        "config": {
          "days_ahead": 1,
          "output_variable": "pipedrive_upcoming_activities"
        },
        "next": "action_2",
        "action_type": "pipedrive_list_upcoming_activities"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": "{{pipedrive_upcoming_activities}}",
          "instructions": "For each upcoming activity, note who it's with and any deal it's linked to. Where a deal is linked, note what would help the salesperson prepare: a summary of the opportunity, open questions, and suggested talking points, based on what's available in this data. Group by activity, most imminent first.",
          "report_title": "Sales Call Briefs",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Today's call briefs",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 181
  },
  {
    "template_id": "tpl_pipedrive_stalled_deal_analysis",
    "name": "AI Stalled Deal Analysis",
    "description": "Reviews open Pipedrive deals every week against recent activity and emails a prioritised list of deals that appear stalled, each classified by likely cause with a recommended next action.",
    "category": "Sales",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "pipedrive",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Get Pipedrive deals",
        "description": "Retrieves open deals from Pipedrive",
        "config": {
          "status": "open",
          "output_variable": "pipedrive_deals"
        },
        "next": "action_2",
        "action_type": "pipedrive_list_deals"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Get recent Pipedrive changes",
        "description": "Retrieves what's changed recently, to identify deals that have gone quiet",
        "config": {
          "since_timestamp": "",
          "items": "deal",
          "output_variable": "pipedrive_recent_changes"
        },
        "next": "action_3",
        "action_type": "pipedrive_list_recent_changes"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved data into a prioritised written report",
        "config": {
          "input": {
            "open_deals": "{{pipedrive_deals}}",
            "recent_changes": "{{pipedrive_recent_changes}}"
          },
          "instructions": "Identify deals that show little or no recent activity or change, by comparing open_deals against recent_changes to see which deals have NOT changed recently. For each apparently stalled deal, classify it as: follow-up required, decision pending, no engagement, internal blocker, poor fit, or insufficient information. Recommend a next action for each. Produce a prioritised list, most concerning first.",
          "report_title": "Stalled Deal Analysis",
          "output_variable": "ai_report"
        },
        "next": "action_4",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Send email report",
        "description": "Sends the report by email",
        "config": {
          "to": "{{user.email}}",
          "subject": "Weekly stalled deal analysis",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 182
  },
  {
    "template_id": "tpl_clickup_smart_intake",
    "name": "Client Request \u2192 Smart ClickUp Intake",
    "description": "When a client request comes in by email, website form, or webhook, AI reads it, sorts it, and creates a ready-to-work ClickUp task \u2014 nobody has to manually type it in.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "webhook",
      "ai",
      "clickup",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Request received",
        "description": "Fires when a request comes in from your website form, another form tool, or any system that can send a webhook. (An 'Email received' trigger can be swapped in instead if requests arrive by email.)",
        "config": {
          "path": "/webhooks/run/{{workflow_id}}",
          "description": "Paste this URL into your website form or form tool as the submission destination",
          "expected_fields": [
            "name",
            "email",
            "message"
          ]
        },
        "next": "action_1",
        "trigger_type": "webhook"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Classify the request",
        "description": "AI sorts the request into a category so it lands in front of the right person",
        "config": {
          "message": "{{payload.message}}",
          "categories": [
            "Technical request",
            "Billing question",
            "General question",
            "Feature request",
            "Complaint"
          ],
          "output_variable": "request_category"
        },
        "next": "action_2",
        "action_type": "classify_message_ai"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Extract task details",
        "description": "AI pulls out a short summary and how urgent the request looks, based only on your own priority rules \u2014 nothing is invented",
        "config": {
          "input": "{{payload.message}}",
          "fields": {
            "summary": "a one-sentence summary of what the client needs",
            "priority": "one of: urgent, high, normal, low \u2014 based only on wording like 'urgent', 'ASAP', a stated deadline, or a system outage; default to normal if nothing suggests otherwise"
          },
          "output_variable": "request_details"
        },
        "next": "action_3",
        "action_type": "extract_information_ai"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Create the ClickUp task",
        "description": "Creates the task in the ClickUp list you choose, with the category, summary and the original message preserved",
        "config": {
          "list_id": "",
          "fields": {
            "name": "{{request_category}}: {{payload.name}}",
            "description": "Submitted by: {{payload.name}} ({{payload.email}})\n\nAI summary: {{request_details.summary}}\n\n---\nOriginal request:\n{{payload.message}}",
            "priority": "{{request_details.priority}}"
          },
          "output_variable": "clickup_task"
        },
        "next": "action_4",
        "action_type": "clickup_create_task"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Notify me it's in ClickUp",
        "description": "A quick in-app heads-up that a new task was created, in case you want to jump straight to it",
        "config": {
          "title": "New ClickUp task from {{payload.name}}",
          "body": "{{request_category}} \u2014 {{request_details.summary}}",
          "link": "",
          "source": "clickup_smart_intake"
        },
        "next": null,
        "action_type": "send_notification"
      }
    ],
    "sort_order": 190
  },
  {
    "template_id": "tpl_notion_client_onboarding",
    "name": "Notion \u2192 Automated Client Onboarding",
    "description": "When a new client row is added to your Notion database, Flow sends the welcome email, marks the record as in progress, and lets you know \u2014 automatically.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "notion",
      "ai",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "New client added in Notion",
        "description": "Fires when a new row appears in the Notion database you choose (checked every few minutes)",
        "config": {
          "database_id": "",
          "description": "Pick your clients/onboarding database"
        },
        "next": "action_1",
        "trigger_type": "notion_new_item"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Read the client's details",
        "description": "AI reads the new Notion row and pulls out the client's name, email and any notes \u2014 so this works whatever your column layout looks like",
        "config": {
          "input": "{{trigger.page.properties}}",
          "fields": {
            "client_name": "the client's name or company name",
            "client_email": "the client's contact email address",
            "client_notes": "anything else relevant to onboarding, e.g. what they signed up for"
          },
          "output_variable": "onboarding_info"
        },
        "next": "action_2",
        "action_type": "extract_information_ai"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "Send the welcome email",
        "description": "Sends the client a welcome email confirming what happens next",
        "config": {
          "to": "{{onboarding_info.client_email}}",
          "subject": "Welcome aboard, {{onboarding_info.client_name}}!",
          "body": "Hi {{onboarding_info.client_name}},\n\nWelcome \u2014 we're glad to have you on board. We've started your onboarding and will follow up shortly with anything we still need from you.\n\nIn the meantime, feel free to reply to this email with any questions.\n\n{{user.business_name}}"
        },
        "next": "action_3",
        "action_type": "send_email"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Mark onboarding as started",
        "description": "Updates the client's Notion record so your team can see the welcome email already went out. Edit the property name/value to match your database's status column.",
        "config": {
          "page_id": "{{trigger.page.id}}",
          "properties": {
            "Onboarding Status": {
              "select": {
                "name": "Welcome email sent"
              }
            }
          }
        },
        "next": "action_4",
        "action_type": "notion_update_page"
      },
      {
        "id": "action_4",
        "type": "action",
        "label": "Notify me a client onboarded",
        "description": "A quick in-app heads-up so you know a new client has started onboarding",
        "config": {
          "title": "Onboarding started: {{onboarding_info.client_name}}",
          "body": "Welcome email sent. Notes: {{onboarding_info.client_notes}}",
          "link": "",
          "source": "notion_onboarding"
        },
        "next": null,
        "action_type": "send_notification"
      }
    ],
    "sort_order": 200
  },
  {
    "template_id": "tpl_notion_operations_digest",
    "name": "Notion \u2192 Business Operations Digest",
    "description": "Every week, Flow reads your Notion workspace and emails you a plain-language summary of what needs attention \u2014 no dashboard to check.",
    "category": "Operations",
    "requires_paid_api": true,
    "is_active": true,
    "integrations_required": [
      "notion",
      "ai",
      "email"
    ],
    "blocks": [
      {
        "id": "trigger_1",
        "type": "trigger",
        "label": "Schedule",
        "description": "Runs on a recurring schedule",
        "config": {
          "frequency": "weekly",
          "time": "07:00",
          "timezone": "Africa/Johannesburg",
          "days": [
            "monday"
          ]
        },
        "next": "action_1",
        "trigger_type": "schedule"
      },
      {
        "id": "action_1",
        "type": "action",
        "label": "Read your operations database",
        "description": "Pulls the current rows from the Notion database you choose \u2014 projects, tasks or clients, whatever you track there",
        "config": {
          "database_id": "",
          "output_variable": "notion_results"
        },
        "next": "action_2",
        "action_type": "notion_query_database"
      },
      {
        "id": "action_2",
        "type": "action",
        "label": "AI business report",
        "description": "Turns the retrieved Notion rows into a short, plain-language weekly summary \u2014 what's outstanding, what's overdue, what's coming up",
        "config": {
          "input": {
            "notion_results": "{{notion_results}}"
          },
          "instructions": "Summarise what needs attention this week: what's outstanding, what's overdue, and what's coming up. Keep it concise and plain-language, prioritising the most urgent items first.",
          "report_title": "Weekly Operations Digest",
          "output_variable": "ai_report"
        },
        "next": "action_3",
        "action_type": "ai_business_report"
      },
      {
        "id": "action_3",
        "type": "action",
        "label": "Send the weekly digest",
        "description": "Emails the summary to you every Monday morning",
        "config": {
          "to": "{{user.email}}",
          "subject": "Your weekly operations digest",
          "body": "{{ai_report}}"
        },
        "next": null,
        "action_type": "send_email"
      }
    ],
    "sort_order": 201
  },
];

/** Creates or updates every template above. Safe to run repeatedly. */
export async function seedTemplates(pb: PocketBase): Promise<void> {
  for (const template of TEMPLATES) {
    const payload = {
      ...template,
      blocks: JSON.stringify(template.blocks),
      integrations_required: JSON.stringify(template.integrations_required),
    };
    let existing: { id: string } | null = null;
    try {
      existing = await pb
        .collection("workflow_templates")
        .getFirstListItem(pb.filter("template_id = {:id}", { id: template.template_id }));
    } catch {
      existing = null;
    }
    if (existing) {
      await pb.collection("workflow_templates").update(existing.id, payload);
    } else {
      await pb.collection("workflow_templates").create(payload);
    }
  }
}
