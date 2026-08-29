import { Resend } from "resend";

// Transactional email via Resend. If RESEND_API_KEY is unset (local dev / tests),
// emails are logged to the console instead of sent, so the flow stays testable
// without credentials.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "Belong <noreply@belong.cyberworksgy.com>";

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
