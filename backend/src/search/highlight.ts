import { embedOne, embedBatch } from './embed.js';

/** A span of text with its char offsets into the ORIGINAL string. */
export interface Span { text: string; start: number; end: number }
/** Char-offset range returned to clients. */
export interface HighlightRange { start: number; end: number }

type SpanEmbedder = (texts: string[]) => Promise<number[][]>;

/** Trim whitespace from [start,end); return the adjusted span or null if empty. */
function trimmedSpan(text: string, start: number, end: number): Span | null {
  while (start < end && /\s/.test(text[start]!)) start++;
  while (end > start && /\s/.test(text[end - 1]!)) end--;
  return start < end ? { text: text.slice(start, end), start, end } : null;
}

/** Split text into clauses on punctuation and coordinating conjunctions, preserving offsets. */
export function splitClauses(text: string): Span[] {
  const spans: Span[] = [];
  const re = /[,;:.!?—]+|\s(?:and|or|but)\s/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = trimmedSpan(text, last, m.index);
    if (s) spans.push(s);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  const tail = trimmedSpan(text, last, text.length);
  if (tail) spans.push(tail);
  return spans;
}

/** Contiguous runs of 1..maxClauses clauses, sliced from the original text (offsets preserved). */
export function candidateSpans(clauses: Span[], text: string, maxClauses = 3): Span[] {
  const out: Span[] = [];
  for (let i = 0; i < clauses.length; i++) {
    for (let n = 1; n <= maxClauses && i + n <= clauses.length; n++) {
      const start = clauses[i]!.start;
      const end = clauses[i + n - 1]!.end;
      out.push({ text: text.slice(start, end), start, end });
    }
  }
  return out;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Pick the span whose vector is most cosine-similar to the query vector. */
export function bestSpanByCosine(queryVec: number[], spans: Span[], spanVecs: number[][]): HighlightRange | null {
  if (!spans.length) return null;
  let best = -Infinity, bi = 0;
  for (let i = 0; i < spans.length; i++) {
    const c = cosine(queryVec, spanVecs[i]!);
    if (c > best) { best = c; bi = i; }
  }
  return { start: spans[bi]!.start, end: spans[bi]!.end };
}

/** True if any query token (length >= 3) appears literally in the text (case-insensitive). */
export function hasKeywordOverlap(query: string, text: string): boolean {
  const toks = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const hay = text.toLowerCase();
  return toks.some((t) => t.length >= 3 && hay.includes(t));
}

/**
 * For each input text, compute the best highlight span (or null when the text is empty
 * or shares a keyword with the query). All eligible spans across all texts are embedded
 * in ONE batch. Returns ranges parallel to `texts`.
 */
export async function computeHighlights(
  query: string,
  queryVec: number[],
  texts: (string | null)[],
  embedSpans: SpanEmbedder = embedBatch,
): Promise<(HighlightRange | null)[]> {
  const perText: (Span[] | null)[] = texts.map((text) => {
    if (!text || hasKeywordOverlap(query, text)) return null;
    const spans = candidateSpans(splitClauses(text), text);
    return spans.length ? spans : null;
  });

  const flat: string[] = [];
  for (const spans of perText) if (spans) for (const s of spans) flat.push(s.text);
  if (!flat.length) return texts.map(() => null);

  const vecs = await embedSpans(flat);
  let k = 0;
  return perText.map((spans) => {
    if (!spans) return null;
    const sliceVecs = vecs.slice(k, k + spans.length);
    k += spans.length;
    return bestSpanByCosine(queryVec, spans, sliceVecs);
  });
}

/** Lazy single-text highlight: embed the query, then compute for one text. */
export async function highlightText(
  query: string,
  text: string,
  embedQuery: (q: string) => Promise<number[]> = embedOne,
  embedSpans: SpanEmbedder = embedBatch,
): Promise<HighlightRange | null> {
  if (!text || hasKeywordOverlap(query, text)) return null;
  const qVec = await embedQuery(query);
  const [range] = await computeHighlights(query, qVec, [text], embedSpans);
  return range ?? null;
}
