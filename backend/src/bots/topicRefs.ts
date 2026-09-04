/**
 * bots/topicRefs.ts — Pure helper for bot root-post content reference assembly.
 *
 * Converts a bom_ai_topic passage_ref string into { anchor, references, resolved }
 * ready to pass to postMessage(db, { ..., anchor, references }).
 *
 * FIRST-CLASS REQUIREMENT: a discussion opener must LINK A TEXT BLOCK from a
 * page (an attached scripture-excerpt card), not merely mention scripture. So
 * this resolves the passage to its containing page unit and returns
 * `resolved: false` when it cannot — the caller MUST skip such topics rather
 * than post a bare mention.
 *
 * Kept pure (accepts a resolveBlockFn stub rather than a Kysely db) so it can be
 * unit-tested without a live database.
 */

import type { PassageBlock, Reference } from '../messaging/contentRefs.js';

export interface TopicRefs {
  /** Page slug — the comment join-key. undefined when unresolved. */
  anchor: string | undefined;
  references: Reference[];
  /** true only when a page text block was linked. false ⇒ caller skips. */
  resolved: boolean;
}

/**
 * Build the anchor + references for a managed-discussion root post.
 *
 * @param passageRef      The topic's passage_ref string, e.g. "Jacob 2:23-35".
 * @param resolveBlockFn  Resolves a passage ref to its containing page block.
 *                        Pass `(r) => resolvePassageBlock(db, r)` in production;
 *                        pass a stub in tests.
 * @returns { anchor, references, resolved }. When resolved, `anchor` is the page
 *          slug and `references` carries an enriched verse ref (slug + ordinal)
 *          so the feed renders the text-block card without a re-resolve.
 */
export async function buildTopicRefs(
  passageRef: string,
  resolveBlockFn: (passageRef: string) => Promise<PassageBlock | null>,
): Promise<TopicRefs> {
  const block = await resolveBlockFn(passageRef);
  if (!block) return { anchor: undefined, references: [], resolved: false };

  const references: Reference[] = [
    {
      type: 'verse',
      id: block.unitFirstVerseId,
      role: 'subject',
      slug: block.pageSlug,
      ordinal: block.ordinal,
    },
  ];
  return { anchor: block.pageSlug, references, resolved: true };
}
