/**
 * bots/openerHighlight.ts — pull a default highlight phrase out of an opener.
 *
 * The opener is asked to end with a line `HIGHLIGHT: <verbatim phrase>` naming
 * the phrase its argument turns on. We split that line off the displayed body
 * and validate the phrase actually appears in the linked block's text
 * (normalized the way the frontend's cleanPhrase does), so the yellow <mark>
 * reliably lands. Invalid/absent → no highlight (graceful).
 */

/** Normalize like the frontend cleanPhrase: lowercase, drop non-alphanumerics. */
export function normalizePhrase(s: string): string {
  return (s || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Strip footnote markers + HTML tags/entities to plain readable text. */
export function htmlToPlain(html: string): string {
  return (html || '')
    .replace(/\[c\]\S*/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OpenerParse {
  /** Opener text with the HIGHLIGHT line removed. */
  body: string;
  /** Validated highlight phrase, or null when absent/unverifiable. */
  highlight: string | null;
  /** One-sentence central claim supplied for evidence review/auditing. */
  thesis: string | null;
}

export function validateHighlight(rawValue: string, blockHtml: string): string | null {
  const raw = (rawValue ?? '').replace(/^["'“”‘’«»]+|["'“”‘’«».]+$/g, '').trim();
  const nPhrase = normalizePhrase(raw);
  const nPlain = normalizePhrase(htmlToPlain(blockHtml));
  return nPhrase.length >= 3 && nPlain.includes(nPhrase) ? raw : null;
}

/** Transparent multilingual centrality check used after exact-source matching. */
export function highlightCentrality(highlight: string, thesis: string, commentary: string): number {
  const tokens = normalizePhrase(highlight).split(/\s+/u).filter((token) => [...token].length >= 2);
  if (!tokens.length) return 0;
  const argumentText = ` ${normalizePhrase(`${thesis} ${commentary}`)} `;
  const matched = tokens.filter((token) => argumentText.includes(` ${token} `)).length;
  return matched / tokens.length;
}

export function highlightIsCentral(highlight: string, thesis: string, commentary: string): boolean {
  return highlightCentrality(highlight, thesis, commentary) >= 0.25;
}

/**
 * Split the trailing `HIGHLIGHT:` line off an opener and validate the phrase
 * against the linked block's plain text.
 */
export function parseOpenerHighlight(opening: string, blockHtml: string): OpenerParse {
  const idx = opening.search(/\n?\s*(?:THESIS|HIGHLIGHT):/i);
  const body = (idx >= 0 ? opening.slice(0, idx) : opening).trim();
  const thesisLine = opening.match(/(?:^|\n)\s*THESIS:\s*([^\n]+)/i);
  const thesis = thesisLine?.[1]?.trim() || null;
  if (idx < 0) return { body, highlight: null, thesis };

  const line = opening.match(/(?:^|\n)\s*HIGHLIGHT:\s*([^\n]+)/i);
  return { body, highlight: validateHighlight(line?.[1] ?? '', blockHtml), thesis };
}
