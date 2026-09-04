import { moveInstruction, type DiscussionMove } from './discussionMoves.js';
import { OPENER_LENGTH_INSTRUCTION, replyLengthInstruction, type ReplyShape } from './replyShape.js';

export interface DiscussionPromptBundle {
  openerTask: string;
  openerLength: string;
  highlightInstruction: string;
  noMetaLeak: string;
  replyLengths: Record<'1' | '2' | '3' | '4', string>;
  replyLength?: string;
  replyLinkSuffix: string;
  moves: Record<DiscussionMove, string>;
}

const DEFAULT_NO_META_LEAK =
  'Never mention retrieval, tools, a corpus, sources, whether sources were "available"/"returned", ' +
  'or that you are reasoning "from persona/profile" — just make the argument in character.';

function parse(raw: unknown): Partial<DiscussionPromptBundle> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Partial<DiscussionPromptBundle>;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Partial<DiscussionPromptBundle>; } catch { return null; }
  }
  return null;
}

export function promptBundle(raw: unknown): Partial<DiscussionPromptBundle> {
  return parse(raw) ?? {};
}

export function openerPrompts(raw: unknown, blockText: string): string[] {
  const bundle = promptBundle(raw);
  const highlight = bundle.highlightInstruction
    ? bundle.highlightInstruction.replaceAll('{{blockText}}', blockText)
    : 'After your argument, on a final separate line, write "HIGHLIGHT: " followed by the exact ' +
      `3-10 word phrase copied verbatim from this linked text:\n"${blockText}"`;
  return [
    bundle.noMetaLeak ?? DEFAULT_NO_META_LEAK,
    bundle.openerLength ?? OPENER_LENGTH_INSTRUCTION,
    highlight,
    bundle.openerTask ?? 'Make one clear, text-centered opening argument about this selected block.',
  ];
}

export function turnPrompts(raw: unknown, move: DiscussionMove | null, shape: ReplyShape): string[] {
  const bundle = promptBundle(raw);
  const legacyKey = String(Math.min(4, shape.targetSentences)) as '1' | '2' | '3' | '4';
  const configuredLength = bundle.replyLength ?? bundle.replyLengths?.[legacyKey];
  const length = configuredLength
    ? configuredLength
      .replaceAll('{{targetWords}}', String(shape.targetWords))
      .replaceAll('{{minWords}}', String(shape.minWords))
      .replaceAll('{{maxWords}}', String(shape.maxWords))
      .replaceAll('{{band}}', shape.band)
    : replyLengthInstruction(shape);
  return [
    bundle.noMetaLeak ?? DEFAULT_NO_META_LEAK,
    move ? (bundle.moves?.[move] ?? moveInstruction(move)) : '',
    length,
    shape.wantsLink && configuredLength
      ? (bundle.replyLinkSuffix ?? 'Weave in one additional supporting scripture, ideally from the Book of Mormon.')
      : '',
  ].filter(Boolean);
}

export function validatePromptBundle(raw: unknown): string[] {
  const bundle = parse(raw);
  if (!bundle) return ['prompt bundle is missing or invalid JSON'];
  const missing: string[] = [];
  for (const key of ['openerTask', 'openerLength', 'highlightInstruction', 'noMetaLeak', 'replyLinkSuffix'] as const) {
    if (!bundle[key]?.trim()) missing.push(key);
  }
  if (!bundle.replyLength?.trim()) {
    for (const target of ['1', '2', '3', '4'] as const) if (!bundle.replyLengths?.[target]?.trim()) missing.push(`replyLengths.${target}`);
  }
  for (const move of ['expand', 'clarify', 'pushback', 'probe', 'reframe', 'concede_qualify', 'respond'] as DiscussionMove[]) {
    if (!bundle.moves?.[move]?.trim()) missing.push(`moves.${move}`);
  }
  return missing;
}
