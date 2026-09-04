/** Per-reply length and linking shape for managed discussions. */

export type ReplyLengthBand = 'micro' | 'short' | 'medium' | 'long' | 'extended';

export interface ReplyShape {
  band: ReplyLengthBand;
  targetWords: number;
  minWords: number;
  maxWords: number;
  /** Compatibility hint for older localized prompt bundles. */
  targetSentences: number;
  cap: number;
  wantsLink: boolean;
}

const LINK_CHANCE = 0.33;
const BANDS: Array<{ band: ReplyLengthBand; cumulative: number; min: number; max: number }> = [
  { band: 'micro', cumulative: 0.18, min: 8, max: 18 },
  { band: 'short', cumulative: 0.52, min: 19, max: 40 },
  { band: 'medium', cumulative: 0.80, min: 41, max: 75 },
  { band: 'long', cumulative: 0.95, min: 76, max: 130 },
  { band: 'extended', cumulative: 1, min: 131, max: 220 },
];

function drawLength(random: () => number) {
  const bandDraw = random();
  const selected = BANDS.find((candidate) => bandDraw < candidate.cumulative) ?? BANDS[BANDS.length - 1]!;
  const targetWords = Math.round(selected.min + random() * (selected.max - selected.min));
  return { ...selected, targetWords };
}

function tooSimilar(candidate: number, priorWordCounts: number[]): boolean {
  return priorWordCounts.slice(-4).some((prior) =>
    prior > 0 && Math.abs(candidate - prior) / Math.max(candidate, prior) < 0.22);
}

/**
 * Draw from a deliberately right-skewed mixture: many short comments, a useful
 * middle, and a sparse long tail. Thread history prevents adjacent replies from
 * repeatedly converging on nearly the same visual length.
 */
export function sampleReplyShape(
  random: () => number = Math.random,
  priorWordCounts: number[] = [],
): ReplyShape {
  let length = drawLength(random);
  for (let attempt = 0; attempt < 3 && tooSimilar(length.targetWords, priorWordCounts); attempt += 1) {
    length = drawLength(random);
  }
  const wantsLink = random() < LINK_CHANCE;
  const tolerance = length.band === 'micro' ? 3 : Math.max(6, Math.round(length.targetWords * 0.2));
  const minWords = Math.max(length.min, length.targetWords - tolerance);
  const maxWords = Math.min(length.max, length.targetWords + tolerance);
  const targetSentences = Math.max(1, Math.min(8, Math.round(length.targetWords / 20)));
  return {
    band: length.band,
    targetWords: length.targetWords,
    minWords,
    maxWords,
    targetSentences,
    cap: Math.max(1, Math.ceil(length.max / 18)),
    wantsLink,
  };
}

export const OPENER_LENGTH_INSTRUCTION =
  'LENGTH: write a focused opening argument in about 110-170 words. Make one clear, ' +
  'text-centered claim and set up the discussion. No padding, no summary of the whole passage.';

export function replyLengthInstruction(shape: ReplyShape): string {
  const base =
    `LENGTH — this OVERRIDES any earlier word-count guidance: aim for ${shape.minWords}-${shape.maxWords} words. ` +
    `Make one useful contribution at that natural size; do not pad a short thought or compress a developed one. ` +
    `No preamble, no passage summary, and no sign-off.`;
  const link = shape.wantsLink
    ? ' Weave in ONE additional supporting scripture — ideally another Book of Mormon passage (book chapter:verse) — that sharpens the point.'
    : '';
  return base + link;
}

export function countReplyWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

export function replyFitsShape(text: string, shape: ReplyShape): boolean {
  const words = countReplyWords(text);
  return words >= shape.minWords && words <= shape.maxWords;
}
