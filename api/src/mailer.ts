import { Resend } from "resend";

// Transactional email via Resend. If RESEND_API_KEY is unset (local dev / tests),
// emails are logged to the console instead of sent, so the flow stays testable
// without credentials.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "Belong <noreply@belongcms.org>";

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  if (!resend) {
    console.log(`[EMAIL MOCK] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return;
  }
  const { error } = await resend.emails.send({ from: MAIL_FROM, to, subject, html, text });
  if (error) {
    throw new Error(`Resend failed to send email to ${to}: ${error.message}`);
  }
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Reset your Belong password",
    text:
      `Someone requested a password reset for your Belong account.\n\n` +
      `Open this link to choose a new password (it expires in 1 hour):\n${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email — your password won't change.`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Someone requested a password reset for your Belong account.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">
            Choose a new password
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If the button doesn't work, paste this URL into your browser:<br>${resetUrl}</p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  };
}

// Sent to SIGNUP_ALERT_EMAIL (an operator inbox, not the new admin) whenever a
// church signs up — see the `SIGNUP_ALERT_EMAIL` handling in routes/auth.ts.
export function signupAlertEmail(opts: { organizationName: string; adminName: string; adminEmail: string; trialEndsAt: Date }) {
  const trialEnds = opts.trialEndsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return {
    subject: `New trial signup: ${opts.organizationName}`,
    text:
      `${opts.organizationName} just started a free trial.\n\n` +
      `Admin: ${opts.adminName} <${opts.adminEmail}>\n` +
      `Trial ends: ${trialEnds}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6;">
        <p><strong>${esc(opts.organizationName)}</strong> just started a free trial.</p>
        <p>
          Admin: ${esc(opts.adminName)} &lt;${esc(opts.adminEmail)}&gt;<br>
          Trial ends: ${trialEnds}
        </p>
      </div>
    `,
  };
}

// Sent to PAYMENT_ALERT_EMAIL (an operator inbox) whenever an org submits an
// MMG payment reference — see the `PAYMENT_ALERT_EMAIL` handling in
// routes/organizations.ts. The org sits in `pending_review` — with no paid
// access gained — until a super-admin verifies it from the admin console.
export function paymentSubmittedAlertEmail(opts: {
  organizationName: string;
  paymentReference: string;
  submittedByEmail: string;
  adminUrl: string;
}) {
  return {
    subject: `Payment reference submitted: ${opts.organizationName}`,
    text:
      `${opts.organizationName} submitted a payment reference and is awaiting verification.\n\n` +
      `Reference: ${opts.paymentReference}\n` +
      `Submitted by: ${opts.submittedByEmail}\n\n` +
      `Verify it and activate the subscription: ${opts.adminUrl}\n\n` +
      `The organization stays in "pending review" — without paid access — until this is done.`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6;">
        <p><strong>${esc(opts.organizationName)}</strong> submitted a payment reference and is awaiting verification.</p>
        <p>
          Reference: <strong>${esc(opts.paymentReference)}</strong><br>
          Submitted by: ${esc(opts.submittedByEmail)}
        </p>
        <p>
          <a href="${opts.adminUrl}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">
            Verify &amp; activate in the admin console
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">The organization stays in "pending review" — without paid access — until this is done.</p>
      </div>
    `,
  };
}

export function welcomeEmail(opts: { name: string; organization: string; trialEndsAt: Date; loginUrl: string }) {
  const trialEnds = opts.trialEndsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return {
    subject: "Welcome to Belong",
    text:
      `Hi ${opts.name},\n\n` +
      `${opts.organization} is set up on Belong and your 14-day free trial runs until ${trialEnds}.\n\n` +
      `Sign in: ${opts.loginUrl}\n\n` +
      `From the dashboard you can add members, group them into households and ministries, ` +
      `record attendance, and print a visitor check-in QR code. When you're ready to subscribe, ` +
      `the Billing page has the payment details.`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Hi ${esc(opts.name)},</p>
        <p><strong>${esc(opts.organization)}</strong> is set up on Belong, and your 14-day free trial runs until <strong>${trialEnds}</strong>.</p>
        <p>
          <a href="${opts.loginUrl}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">
            Sign in to Belong
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">From the dashboard you can add members, group them into households and ministries, record attendance, and print a visitor check-in QR code. When you're ready to subscribe, the Billing page has the payment details.</p>
      </div>
    `,
  };
}
