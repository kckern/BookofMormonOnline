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
import type { EmailMessage, Mailer, SendResult } from './types.js';
import { ConsoleMailer } from './adapters/console.js';
import { SesMailer } from './adapters/ses.js';

export type { EmailMessage, Mailer, SendResult } from './types.js';
export { ConsoleMailer } from './adapters/console.js';

let _instance: Mailer | null = null;

/**
 * Singleton mailer, selected by MAIL_PROVIDER (the adapter seam). 'console'
 * forces the log-only transport; 'ses' uses SES when MAIL_FROM is set and falls
 * back to console otherwise. Add a provider by extending the env enum + a branch
 * here + a `Mailer` implementation — callers never change.
 */
export function getMailer(): Mailer {
  if (!_instance) {
    if (env.MAIL_PROVIDER === 'console') {
      _instance = new ConsoleMailer();
    } else {
      _instance = env.MAIL_FROM
        ? new SesMailer(env.MAIL_FROM, env.MAIL_REGION, env.MAIL_CONFIGURATION_SET)
        : new ConsoleMailer();
    }
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
