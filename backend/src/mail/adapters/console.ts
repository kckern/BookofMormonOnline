import type { EmailMessage, Mailer, SendResult } from '../types.js';

/** Log-only adapter for local development and controlled tests. */
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<SendResult> {
    console.info(
      `[mailer:console] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
    );
    return { ok: true, id: 'console' };
  }
}
