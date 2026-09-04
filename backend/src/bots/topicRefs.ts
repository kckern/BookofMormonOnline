/**
 * bots/topicRefs.ts — Pure helper for bot root-post content reference assembly.
 *
 * Converts a bom_ai_topic passage_ref string into { anchor, references }
 * ready to pass to postMessage(db, { ..., anchor, references }).
 *
 * Kept pure (accepts a resolveFn stub rather than a Kysely db) so it can be
 * unit-tested without a live database.
 */

import { refToVerseIds } from '../messaging/contentRefs.js';
import type { Reference, VerseDisplay } from '../messaging/contentRefs.js';

export interface TopicRefs {
  anchor: string | undefined;
  references: Reference[];
}

/**
 * Build the anchor + references for a managed-discussion root post.
 *
 * @param passageRef  The topic's passage_ref string, e.g. "Alma 32:21".
 * @param resolveFn   Async function that turns a verse id into display info.
 *                    Pass `resolveVerseDisplay.bind(null, db)` in production;
 *                    pass a stub in tests.
 * @returns { anchor, references } suitable for postMessage params.
 *          anchor is undefined when the ref is unparseable or the display
 *          lookup returns null.  references is [] when no verse ids resolve.
 */
export async function buildTopicRefs(
  passageRef: string,
  resolveFn: (verseId: number) => Promise<VerseDisplay | null>,
): Promise<TopicRefs> {
  const verseIds = refToVerseIds(passageRef);
  if (!verseIds.length) {
    return { anchor: undefined, references: [] };
  }

  const primaryId = verseIds[0]!;
  const references: Reference[] = [{ type: 'verse', id: primaryId, role: 'subject' }];

  const display = await resolveFn(primaryId);
  const anchor = display?.slug ?? undefined;

  return { anchor, references };
}
