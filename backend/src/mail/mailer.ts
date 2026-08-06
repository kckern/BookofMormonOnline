/**
 * mailer.ts — the transactional email layer (provider-agnostic port).
 *
 * `Mailer.send()` resolves to a SendResult; implementations MUST NOT throw —
 * failures are caught and returned as `{ ok:false, error }` so callers (e.g. the
 * password-reset resolver) never crash on a mail hiccup.
 *
 * getMailer() returns a `SesMailer` when SES is configured (env.MAIL_FROM set),
 * otherwise a `ConsoleMailer` that logs the message instead of sending — safe in
 * dev and before AWS creds land, and injectable in tests via resetMailer().
 * Mirrors the getLlmGateway() factory pattern.
 */
import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface Mailer {
  send(msg: EmailMessage): Promise<SendResult>;
}

/** Fallback transport — logs the message. Used when SES is unconfigured / in tests. */
export class ConsoleMailer implements Mailer {
  async send(msg: EmailMessage): Promise<SendResult> {
    console.info(
      `[mailer:console] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`,
    );
    return { ok: true, id: 'console' };
  }
}

/** Amazon SES transport. Lazily loads the SDK + client so the dep only loads when actually sending. */
export class SesMailer implements Mailer {
  #from: string;
  #region: string;
  #client: unknown | null = null;

  constructor(from: string, region: string) {
    this.#from = from;
    this.#region = region;
  }

  async send(msg: EmailMessage): Promise<SendResult> {
    try {
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
      if (!this.#client) this.#client = new SESClient({ region: this.#region });
      const client = this.#client as InstanceType<typeof SESClient>;
      const out = await client.send(
        new SendEmailCommand({
          Source: this.#from,
          Destination: { ToAddresses: [msg.to] },
          Message: {
            Subject: { Data: msg.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: msg.html, Charset: 'UTF-8' },
              Text: { Data: msg.text, Charset: 'UTF-8' },
            },
          },
        }),
      );
      return { ok: true, id: out.MessageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[mailer:ses] send failed to=${msg.to}: ${error}`);
      return { ok: false, error };
    }
  }
}

let _instance: Mailer | null = null;

/** Singleton mailer — SES when configured, else the console fallback. */
export function getMailer(): Mailer {
  if (!_instance) {
    _instance = env.MAIL_FROM
      ? new SesMailer(env.MAIL_FROM, env.MAIL_REGION)
      : new ConsoleMailer();
  }
  return _instance;
}

/** Replace or clear the singleton (tests inject a fake; null re-creates the default). */
export function resetMailer(mailer: Mailer | null = null): void {
  _instance = mailer;
}

/** Convenience — send via the singleton. */
export function sendEmail(msg: EmailMessage): Promise<SendResult> {
  return getMailer().send(msg);
}
