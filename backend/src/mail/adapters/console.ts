import type { EmailMessage, Mailer, SendResult } from '../types.js';

/** Log-only adapter for local development and controlled tests. */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<SendResult> {
    // Do not log the recipient or body: reset/verify emails carry single-use
    // tokens and the recipient address is PII (2026-09-08 security audit).
    console.info(
      `[mailer:console] send subject=${JSON.stringify(message.subject)} (recipient + body suppressed)`,
    );
    return { ok: true, id: 'console' };
  }
}
