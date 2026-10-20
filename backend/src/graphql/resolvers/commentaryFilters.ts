// Home commentary sampler: drop "dud" rows (blind r8 commentary-H1). About one
// sampled commentary in three was a bare pointer ("For a general discussion,
// see under … in volume 3."), a title stub, a citation dump ("Hel. 8:2; Moses
// 6:63; …") or a mid-sentence fragment ("refer in this text to …"). The tile
// shows the prose a reader meets first, so judge exactly that prose.
import { buildPreview } from './scriptureextras.js';

type CommentaryRow = { text?: string | null; is_note?: number | null };

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', quot: '"', gt: '>', lt: '<' };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);

/** The prose the Home tile shows: an ATV row's bracket-free preview, else the text. */
export function commentaryProse(row: CommentaryRow): string {
  const text = row.text || '';
  if (/class=['"]source['"]/.test(text)) return buildPreview(text, Number(row.is_note) || 0) || '';
  return decode(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const MIN_PROSE = 200;
const POINTER = /^(?:for (?:a|the) (?:general |fuller |more )?discussion|see (?:also )?(?:under|the discussion|volume))/i;
// "Hel. 8:2", "1 Ne. 19:10", "D&C 88:7", "Psalm 19:1"
const REF = /^(?:\d\s*)?[A-Z][\w&.]*\.?\s+\d+[:.]\d+/;

export function isDudCommentary(row: CommentaryRow): boolean {
  const p = commentaryProse(row).replace(/^[“"‘'(\s]+/, '');
  if (p.length < MIN_PROSE) return true;
  if (/^\p{Ll}/u.test(p)) return true; // opens mid-sentence
  if (POINTER.test(p)) return true;
  if (/\bsee under\b/i.test(p.slice(0, 200))) return true;
  if (REF.test(p) && p.slice(0, 60).includes(';')) return true; // citation run
  return false;
}
