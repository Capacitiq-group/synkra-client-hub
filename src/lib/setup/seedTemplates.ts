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
  }
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
