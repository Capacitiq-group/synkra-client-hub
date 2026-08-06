// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import type PocketBase from "pocketbase";

export const TEMPLATES = [
  {
    template_id: "tpl_lead_notification",
    name: "New lead notification",
    description:
      "When someone submits a form on your website, you get an email immediately with their details.",
    category: "Sales",
    requires_paid_api: false,
    integrations_required: ["email"],
    is_active: true,
    sort_order: 1,
    blocks: [
      {
        id: "trigger_1",
        type: "trigger",
        trigger_type: "webhook",
        label: "Form submitted",
        description: "Fires when a contact form or lead form is submitted",
        config: {
          path: "/webhooks/lead/{{workspace_id}}",
          description:
            "Paste this URL into your website form or Typeform as the submission destination",
          expected_fields: ["name", "email", "phone", "message"],
        },
        next: "action_1",
      },
      {
        id: "action_1",
        type: "action",
        action_type: "send_email",
        label: "Email notification to owner",
        description: "Sends you an email the moment a lead submits their details",
        config: {
          to: "{{user.email}}",
          subject: "New lead from {{payload.name}}",
          body: "Hi,\n\nA new lead just came in.\n\nName: {{payload.name}}\nEmail: {{payload.email}}\nPhone: {{payload.phone}}\nMessage: {{payload.message}}\n\nReply to this email to follow up.\n\nSynkra",
        },
        next: null,
      },
    ],
  },
  {
    template_id: "tpl_daily_digest",
    name: "Daily business digest",
    description: "Every morning at 7am you get a summary email of what happened in your business.",
    category: "Operations",
    requires_paid_api: false,
    integrations_required: ["email"],
    is_active: true,
    sort_order: 2,
    blocks: [
      {
        id: "trigger_1",
        type: "trigger",
        trigger_type: "schedule",
        label: "Every day at 7am",
        description: "Runs automatically every morning at 7am South African time",
        config: { frequency: "daily", time: "07:00", timezone: "Africa/Johannesburg" },
        next: "action_1",
      },
      {
        id: "action_1",
        type: "action",
        action_type: "send_email",
        label: "Send digest email",
        description: "Sends your morning summary to your email address",
        config: {
          to: "{{user.email}}",
          subject: "Your daily business digest",
          body: "Good morning,\n\nHere is your summary for today.\n\nThis digest runs every day at 7am. You can customise what it includes as your account grows.\n\nSynkra",
        },
        next: null,
      },
    ],
  },
  {
    template_id: "tpl_appointment_reminder",
    name: "Appointment reminder",
    description: "Automatically email your customer a reminder 24 hours before their appointment.",
    category: "Customer Service",
    requires_paid_api: false,
    integrations_required: ["email"],
    is_active: true,
    sort_order: 3,
    blocks: [
      {
        id: "trigger_1",
        type: "trigger",
        trigger_type: "webhook",
        label: "Appointment booked",
        description:
          "Fires when a new appointment is booked. Send this webhook from your booking system.",
        config: {
          path: "/webhooks/appointment/{{workspace_id}}",
          description: "Fire this webhook when an appointment is booked",
          expected_fields: ["customer_name", "customer_email", "appointment_datetime"],
        },
        next: "action_1",
      },
      {
        id: "action_1",
        type: "action",
        action_type: "wait",
        label: "Wait until 24 hours before",
        description: "The workflow pauses here and continues 24 hours before the appointment time",
        config: { wait_until: "{{payload.appointment_datetime}} - 24 hours" },
        next: "action_2",
      },
      {
        id: "action_2",
        type: "action",
        action_type: "send_email",
        label: "Send reminder email",
        description: "Sends a friendly reminder to the customer before their appointment",
        config: {
          to: "{{payload.customer_email}}",
          subject: "Reminder: Your appointment tomorrow",
          body: "Hi {{payload.customer_name}},\n\nThis is a reminder about your appointment scheduled for {{payload.appointment_datetime}}.\n\nIf you need to reschedule please reply to this email as soon as possible.\n\n{{user.business_name}}",
        },
        next: null,
      },
    ],
  },
  {
    template_id: "tpl_review_request",
    name: "Review request",
    description: "After a completed job, automatically ask your customer to leave a Google review.",
    category: "Marketing",
    requires_paid_api: false,
    integrations_required: ["email"],
    is_active: true,
    sort_order: 4,
    blocks: [
      {
        id: "trigger_1",
        type: "trigger",
        trigger_type: "webhook",
        label: "Job completed",
        description: "Fires when a job or service is marked as complete",
        config: {
          path: "/webhooks/job-complete/{{workspace_id}}",
          description: "Fire this when a job is done",
          expected_fields: ["customer_name", "customer_email", "review_link"],
        },
        next: "action_1",
      },
      {
        id: "action_1",
        type: "action",
        action_type: "wait",
        label: "Wait 24 hours",
        description:
          "Gives the customer time to reflect on the experience before asking for a review",
        config: { duration: 24, unit: "hours" },
        next: "action_2",
      },
      {
        id: "action_2",
        type: "action",
        action_type: "send_email",
        label: "Send review request",
        description: "A warm email asking for an honest review with a direct link",
        config: {
          to: "{{payload.customer_email}}",
          subject: "How did we do?",
          body: "Hi {{payload.customer_name}},\n\nThank you for choosing {{user.business_name}}. We hope everything went well.\n\nIf you have a moment, we would really appreciate a quick review. It helps other customers find us and helps us keep improving.\n\nLeave a review here: {{payload.review_link}}\n\nThank you.\n\n{{user.business_name}}",
        },
        next: null,
      },
    ],
  },
  {
    template_id: "tpl_invoice_reminder",
    name: "Invoice payment reminder",
    description:
      "Automatically remind customers about unpaid invoices before and after the due date.",
    category: "Finance",
    requires_paid_api: false,
    integrations_required: ["email"],
    is_active: true,
    sort_order: 5,
    blocks: [
      {
        id: "trigger_1",
        type: "trigger",
        trigger_type: "webhook",
        label: "Invoice created",
        description: "Fires when an invoice is sent to a customer",
        config: {
          path: "/webhooks/invoice/{{workspace_id}}",
          description: "Fire this when you send an invoice",
          expected_fields: [
            "customer_name",
            "customer_email",
            "invoice_number",
            "amount",
            "due_date",
          ],
        },
        next: "action_1",
      },
      {
        id: "action_1",
        type: "action",
        action_type: "wait",
        label: "Wait until 3 days before due date",
        description: "Pauses until 3 days before payment is due",
        config: { wait_until: "{{payload.due_date}} - 3 days" },
        next: "action_2",
      },
      {
        id: "action_2",
        type: "action",
        action_type: "send_email",
        label: "Send first reminder",
        description: "A friendly reminder that payment is due soon",
        config: {
          to: "{{payload.customer_email}}",
          subject: "Invoice {{payload.invoice_number}} due in 3 days",
          body: "Hi {{payload.customer_name}},\n\nThis is a reminder that invoice {{payload.invoice_number}} for R{{payload.amount}} is due in 3 days.\n\nPlease arrange payment at your earliest convenience.\n\n{{user.business_name}}",
        },
        next: "action_3",
      },
      {
        id: "action_3",
        type: "action",
        action_type: "wait",
        label: "Wait until 1 day after due date",
        description: "Pauses until the day after the invoice was due",
        config: { wait_until: "{{payload.due_date}} + 1 day" },
        next: "action_4",
      },
      {
        id: "action_4",
        type: "action",
        action_type: "send_email",
        label: "Send overdue notice",
        description: "A firmer message letting the customer know their invoice is overdue",
        config: {
          to: "{{payload.customer_email}}",
          subject: "Invoice {{payload.invoice_number}} is now overdue",
          body: "Hi {{payload.customer_name}},\n\nInvoice {{payload.invoice_number}} for R{{payload.amount}} was due yesterday and remains unpaid.\n\nPlease contact us to arrange payment or to discuss your account.\n\n{{user.business_name}}",
        },
        next: null,
      },
    ],
  },
];

export async function seedTemplates(pb: PocketBase): Promise<void> {
  const existing = await pb.collection("workflow_templates").getFullList();
  const existingIds = new Set(
    existing.map((t) => (t as unknown as { template_id?: string }).template_id),
  );

  for (const template of TEMPLATES) {
    if (existingIds.has(template.template_id)) continue;
    await pb.collection("workflow_templates").create({
      ...template,
      blocks: JSON.stringify(template.blocks),
      integrations_required: JSON.stringify(template.integrations_required),
    });
  }
}
