/**
 * Transactional email (server only).
 *
 * Primary path is Resend. When RESEND_API_KEY is absent the message is handed
 * to the existing synkra-core notification endpoint instead, so a deploy
 * without Resend still delivers rather than silently dropping the email.
 */
export function appUrl(): string {
  return (process.env["APP_URL"] || process.env["VITE_APP_URL"] || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendViaResend(input: EmailInput, apiKey: string) {
  const from = process.env["RESEND_FROM"] || "Synkra <noreply@synkra.co.za>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rejected the email (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendViaCore(input: EmailInput) {
  const secret = process.env["API_SECRET"] || "";
  const api = process.env["API_URL"] || "";
  if (!secret || !api) throw new Error("No email provider is configured on the server.");
  const response = await fetch(`${api.replace(/\/+$/, "")}/workflows/notifications/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Synkra-Secret": secret },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      body: input.text,
      from_name: "Synkra",
    }),
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
}

export async function sendEmail(input: EmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env["RESEND_API_KEY"] || "";
  try {
    if (apiKey) await sendViaResend(input, apiKey);
    else await sendViaCore(input);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "email_failed" };
  }
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0b0f0d;padding:32px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#121815;border:1px solid #1f2b25;border-radius:14px;padding:32px">
    <tr><td style="color:#eaf3ee;font-size:20px;font-weight:700;padding-bottom:12px">${title}</td></tr>
    <tr><td style="color:#a9bab1;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
    <tr><td style="color:#6d7f76;font-size:12px;padding-top:28px">Synkra — automation for small business.</td></tr>
  </table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#25d07a;color:#07130d;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${label}</a></p>`;
}

export function magicLinkEmail(link: string, minutes: number): Omit<EmailInput, "to"> {
  return {
    subject: "Your Synkra sign-in link",
    html: shell(
      "Sign in to Synkra",
      `<p>Use the button below to sign in. The link works once and expires in ${minutes} minutes.</p>${button(
        link,
        "Sign in to Synkra",
      )}<p style="font-size:13px;color:#6d7f76">If you did not request this, you can ignore this email.</p>`,
    ),
    text: `Sign in to Synkra: ${link}\nThis link works once and expires in ${minutes} minutes.`,
  };
}

export function welcomeEmail(link: string, planName: string): Omit<EmailInput, "to"> {
  return {
    subject: `Your Synkra ${planName} plan is active`,
    html: shell(
      `Your ${planName} plan is active`,
      `<p>Payment received. Your workspace is ready — use the button below to sign in. The link works once and expires in 30 minutes.</p>${button(
        link,
        "Open my workspace",
      )}`,
    ),
    text: `Your Synkra ${planName} plan is active. Sign in: ${link}`,
  };
}

export function invitationEmail(link: string, workspace: string): Omit<EmailInput, "to"> {
  return {
    subject: `You have been invited to ${workspace} on Synkra`,
    html: shell(
      `Join ${workspace}`,
      `<p>You have been invited to collaborate in the ${workspace} workspace on Synkra.</p>${button(
        link,
        "Accept invitation",
      )}`,
    ),
    text: `You have been invited to ${workspace} on Synkra. Accept: ${link}`,
  };
}

/** Confirmation for a settled add-on purchase. Units are already granted. */
export function addonPurchaseEmail(
  label: string,
  units: number,
  unit: string,
): Omit<EmailInput, "to"> {
  const quantity = `${units.toLocaleString("en-ZA")} ${unit}`;
  return {
    subject: `Your ${label} add-on purchase is confirmed`,
    html: shell(
      `${label} add-on confirmed`,
      `<p>Thanks for your purchase — ${quantity} have been added to your account and are ready to use.</p>${button(
        `${appUrl()}/dashboard/settings`,
        "View my usage",
      )}`,
    ),
    text: `Your ${label} add-on purchase is confirmed. ${quantity} have been added to your account and are ready to use. ${appUrl()}/dashboard/settings`,
  };
}

