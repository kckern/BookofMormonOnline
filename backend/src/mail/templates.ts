/**
 * templates.ts — typed transactional-email builders. One function per email
 * type, returning { subject, html, text }. Keep copy here so the mailer stays
 * transport-only. HTML is intentionally minimal (deliverability > design).
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Password-reset email — a single-use link valid for 30 minutes. */
export function passwordResetEmail(resetUrl: string, name?: string): EmailContent {
  const who = name ? `Hi ${name},` : 'Hello,';
  const subject = 'Reset your Book of Mormon Online password';
  const text =
    `${who}\n\n` +
    `We received a request to reset your password. Use the link below within 30 minutes:\n\n` +
    `${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.`;
  const html =
    `<p>${esc(who)}</p>` +
    `<p>We received a request to reset your password. This link is valid for 30 minutes:</p>` +
    `<p><a href="${esc(resetUrl)}">Reset your password</a></p>` +
    `<p style="color:#888;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`;
  return { subject, html, text };
}
