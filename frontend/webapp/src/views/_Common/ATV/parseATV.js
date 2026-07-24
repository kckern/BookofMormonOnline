/**
 * Pure parser for Royal Skousen's Analysis of Textual Variants apparatus.
 * No DOM, no React, no I/O — string in, plain data out. Reference tables live
 * in apparatus.js.
 */

import { isSiglum } from "./apparatus";

/**
 * Top-level bracket groups, by depth counting. Unlike a non-greedy regex this
 * survives nesting: `[Benjamin [Mosiah?] P]` is ONE group, not a broken prefix.
 * Unbalanced input yields no group rather than a partial one.
 */
export function scanBrackets(html) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "]" && depth > 0) {
      depth--;
      if (depth === 0) out.push(html.slice(start + 1, i));
    }
  }
  return out;
}

/**
 * Trailing run of sigla on a reading, or null. Trims first — the data has
 * `"… 1 |"` with a trailing space, which anchored matching would miss.
 *
 * Assumes witnesses are separated from reading content by whitespace or a tag
 * boundary. A reading whose visible text ends in a run of witness-letters
 * directly abutting its sigla (no separator) would be mis-split — e.g.
 * "…ALMA" ("ALMA" = A,L,M,A, all valid witnesses) parses correctly only
 * because a space precedes the real sigla run. This has no shape-based
 * solution: content abutting sigla with no separator is genuinely
 * indistinguishable from content+sigla. Verified 0 such cases in the corpus;
 * `corpusCheck.mjs` (Task 8) is the standing guard.
 */
export function trailingSigla(part) {
  const t = part.trim();
  const m = t.match(/[A-Z01]+$/);
  if (!m) return null;
  return [...m[0]].every(isSiglum) ? m[0] : null;
}

/**
 * A bracket group is a variation unit iff it splits on "|" into >= 2 parts and
 * EVERY part ends in a run of known sigla. Shape, not letters — `[JST]` is made
 * of three real sigla but is a prose reference, not a unit.
 */
export function isApparatus(inner) {
  const parts = inner.split("|");
  if (parts.length < 2) return false;
  return parts.every((p) => trailingSigla(p) !== null);
}

/**
 * Split one "|"-part into its content and its witnesses. Never throws; a part
 * with no trailing sigla comes back as content with an empty witness list.
 * Correction markers are left in the content for the chain parser.
 */
export function splitReading(part) {
  const t = part.trim();
  const sigla = trailingSigla(part);
  if (!sigla) return { content: t, sigla: [] };
  // Positional slice, NOT String.replace — replace removes the first match,
  // which corrupts readings whose own text contains the sigla substring
  // ("And it came to pass that A" loses the A of "And").
  return {
    content: t.slice(0, t.length - sigla.length).trim(),
    sigla: [...sigla],
  };
}
