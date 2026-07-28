import { detectScriptures } from "scripture-guide";

/**
 * The NEAREST scripture reference in an HTML/text slice, or null.
 *
 * detectScriptures fires its callback in document order, so the last call is the
 * nearest reference. It also COALESCES adjacent citations (e.g. "A, B" or
 * "A and B") into one ";"-joined string; we take the last ";"-segment to keep
 * the nearest single ref. (Resolving the joined string directly would wrongly
 * pick the EARLIER verse, since lookupReference returns verse_ids[0].)
 */
export function lastScriptureRef(html, lang) {
  let last = null;
  detectScriptures(html || "", (s) => { if (s) last = s; return s; }, lang);
  return last ? last.split(";").pop().trim() : null;
}
