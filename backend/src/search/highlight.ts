/** A span of text with its char offsets into the ORIGINAL string. */
export interface Span { text: string; start: number; end: number }
/** Char-offset range returned to clients. */
export interface HighlightRange { start: number; end: number }

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
