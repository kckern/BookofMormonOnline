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
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
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
}

/**
 * Split the trailing `HIGHLIGHT:` line off an opener and validate the phrase
 * against the linked block's plain text.
 */
export function parseOpenerHighlight(opening: string, blockHtml: string): OpenerParse {
  const idx = opening.search(/\n?\s*HIGHLIGHT:/i);
  const body = (idx >= 0 ? opening.slice(0, idx) : opening).trim();
  if (idx < 0) return { body, highlight: null };

  const line = opening.slice(idx).match(/HIGHLIGHT:\s*([^\n]+)/i);
  const raw = (line?.[1] ?? '').replace(/^["'“”‘’]+|["'“”‘’.]+$/g, '').trim();
  const nPhrase = normalizePhrase(raw);
  const nPlain = normalizePhrase(htmlToPlain(blockHtml));
  if (nPhrase.length >= 3 && nPlain.includes(nPhrase)) return { body, highlight: raw };
  return { body, highlight: null };
}
