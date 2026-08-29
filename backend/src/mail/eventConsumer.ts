import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { env } from '../config/env.js';

/** Provider selection seam; provider SDKs remain inside adapter modules. */
export async function startMailEventConsumer(db: Kysely<DB>): Promise<() => void> {
  if (!env.MAIL_EVENT_QUEUE_URL || env.MAIL_PROVIDER === 'console') return () => undefined;
  if (env.MAIL_PROVIDER === 'ses') {
    const { startSesEventConsumer } = await import('./adapters/sesEvents.js');
    return startSesEventConsumer(db);
  }
  return () => undefined;
}
