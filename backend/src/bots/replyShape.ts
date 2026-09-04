/**
 * bots/replyShape.ts — per-reply length + linking shape.
 *
 * Reformer discussion replies must be short with controlled variety (KC): most
 * are ~2 sentences, a few longer, and longer is EARNED — allowed only when a
 * reply also brings in a scripture link. We sample a target sentence count from
 * a fixed histogram per turn and, ~1 in 3 turns, ask the reply to cite an extra
 * scripture (which renders its own card and unlocks the longer bound).
 *
 * Histogram (target sentences): 1→15% · 2→45% · 3→25% · 4→15%  (mean ≈ 2.4)
 * Cap: 4 normally, 6 when linking. Link frequency: ~33%.
 */

export interface ReplyShape {
  /** Target sentence count for the reply. */
  targetSentences: number;
  /** Hard upper bound communicated to the model. */
  cap: number;
  /** Whether this reply should bring in an additional scripture link. */
  wantsLink: boolean;
}

const LINK_CHANCE = 0.33;

/** Sample a reply's length + link shape. `random` injectable for tests. */
export function sampleReplyShape(random: () => number = Math.random): ReplyShape {
  const r = random() * 100;
  const targetSentences = r < 15 ? 1 : r < 60 ? 2 : r < 85 ? 3 : 4;
  const wantsLink = random() < LINK_CHANCE;
  const cap = wantsLink ? 6 : 4;
  return { targetSentences, cap, wantsLink };
}

/** Opening-argument length. The opener sets up the discussion, so it may be
 *  more substantial than a reply — but not a wall. */
export const OPENER_LENGTH_INSTRUCTION =
  'LENGTH: write a focused opening argument in about 110-170 words. Make one clear, ' +
  'text-centered claim and set up the discussion. No padding, no summary of the whole passage.';

/**
 * The length instruction appended to a REPLY turn's system guidance. Anchored in
 * words (what the model actually obeys) and marked as overriding, because the
 * base template hardcodes a 120-220 word count meant for the opener. "Keep
 * sentences short" curbs the run-on-sentence bloat.
 */
export function replyLengthInstruction(shape: ReplyShape): string {
  const maxWords = shape.targetSentences * 22 + (shape.wantsLink ? 30 : 0);
  const s = shape.targetSentences === 1 ? 'one short sentence' : `${shape.targetSentences} short sentences`;
  const base =
    `LENGTH — this OVERRIDES any earlier word-count guidance: reply in ${s}, ` +
    `under ~${maxWords} words total. Make ONE point, plainly. Keep each sentence short. ` +
    `No preamble, no summary of the passage, no sign-off.`;
  const link = shape.wantsLink
    ? ' Weave in ONE additional supporting scripture — ideally another Book of Mormon passage (book chapter:verse) — that sharpens the point.'
    : '';
  return base + link;
}
