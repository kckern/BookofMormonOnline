/**
 * Pure parser for Royal Skousen's Analysis of Textual Variants apparatus.
 * No DOM, no React, no I/O — string in, plain data out. Reference tables live
 * in apparatus.js.
 */

import { isSiglum, describeChange, decodeMarker } from "./apparatus";

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

/**
 * Build one State from a raw content fragment and its `via`. A state is
 * "omitted" (renders as ∅) when its visible text — tags stripped, trimmed — is
 * empty or exactly "NULL"; an omitted state's content is normalised to "".
 * Otherwise the content is kept verbatim (tags and entities intact) after a
 * trim. Never strips entities: `&hellip;`, `&#120034;` etc. must reach the
 * renderer encoded.
 */
function makeState(rawContent, via) {
  const trimmed = rawContent.trim();
  const stripped = trimmed.replace(/<[^>]*>/g, "").trim();
  const omitted = stripped === "" || stripped === "NULL";
  return { content: omitted ? "" : trimmed, omitted, via };
}

/**
 * Given the raw text AFTER a correction marker and BEFORE the next marker,
 * peel off the correction code and return `{ via, contentRaw }`.
 *
 * The code token is the run of code characters right after the marker, with at
 * most one optional space between. Because a code is always delimited by
 * whitespace (or the string end) on its far side, that maximal run IS the whole
 * token — so a code is recognised by matching the entire run, not a prefix.
 * This is what keeps a spaced bare marker whose content starts with a code
 * letter (`&gt; people`) from being misread as code `p`.
 *
 *   - run decodes to a KNOWN code  -> that code (tight or spaced)
 *   - run is unknown, TIGHT and code-SHAPED -> unknown code, surfaced (label null)
 *   - anything else (spaced, empty, or a long word) -> bare marker, run STAYS content
 *
 * `decodeMarker` is applied ONLY to the isolated code run, never to content.
 */

/**
 * Could a decoded run plausibly be a (possibly mistyped) correction code? Every
 * real code is at most two decoded characters (`js`, `+–`, `%?`, `p–`…) or bears
 * a code symbol (`+ % ? –`). A longer purely-alphabetic run — an abutting word
 * like `&gt;people` — is never a code, so it must NOT be consumed as one; doing
 * so would delete the word and render it as ∅. This gate keeps that content.
 */
const isPlausibleCode = (s) => s.length <= 2 || /[+%?–]/.test(s);

function parseMarkerSegment(rest) {
  const wsMatch = rest.match(/^\s+/);
  const hadSpace = !!wsMatch;
  const wsLen = wsMatch ? wsMatch[0].length : 0;
  const afterWs = rest.slice(wsLen);
  // Code characters: the letters Skousen's codes use (j, g, s, p, b), the
  // symbols + % ? and the en-dash both as a literal and as the &ndash; entity.
  const candMatch = afterWs.match(/^(?:&ndash;|[a-zA-Z+%?–])+/);
  const rawCand = candMatch ? candMatch[0] : "";
  const decoded = decodeMarker(rawCand);
  const known = decoded !== "" && describeChange(decoded) !== null;

  if (known) {
    return {
      via: { code: decoded, label: describeChange(decoded) },
      contentRaw: rest.slice(wsLen + rawCand.length),
    };
  }
  if (!hadSpace && rawCand !== "" && isPlausibleCode(decoded)) {
    // Tight, code-shaped, but unrecognised: still a marker, surface the token so
    // a caller can flag it rather than mislabel it. label is null (describeChange
    // miss). A long alphabetic word is NOT code-shaped and falls through below.
    return {
      via: { code: decoded, label: describeChange(decoded) },
      contentRaw: afterWs.slice(rawCand.length),
    };
  }
  // Bare marker: no code. The run (if any) is content, not a code — never delete it.
  return { via: { code: null, label: describeChange(null) }, contentRaw: afterWs };
}

/**
 * Parse a reading's content (sigla already removed by splitReading) into the
 * ordered sequence of states its in-document correction chain passed through.
 *
 * A correction marker is the entity `&gt;` OR a literal `>` preceded by
 * whitespace. A tag-closing `>` (in `<em>`, `</em>`, `<br>`…) is a literal `>`
 * that is never an entity and never preceded by whitespace, so it is not a
 * marker. Each marker begins a new state; `states[0]` is the original reading
 * and has `via: null`. Always returns at least one state; never throws.
 */
export function parseStates(content) {
  const src = content == null ? "" : String(content);
  // Marker = &gt; OR a literal > preceded by whitespace. Matched WITHOUT a
  // lookbehind: `(?<=\s)>` is ES2018, which Babel does not transpile, so it
  // throws a parse-time SyntaxError on browsers lacking runtime support (Safari
  // <16.4) and blanks the page. Match the whitespace explicitly, then offset the
  // index past it; the whitespace stays with the preceding state and is trimmed.
  const markerRe = /&gt;|\s>/g;
  const markers = [];
  let m;
  while ((m = markerRe.exec(src)) !== null) {
    const isEntity = m[0] === "&gt;";
    markers.push({
      index: isEntity ? m.index : m.index + 1, // skip the leading whitespace char
      length: isEntity ? 4 : 1, // "&gt;" is 4 chars, ">" is 1
    });
  }

  const firstIdx = markers.length ? markers[0].index : src.length;
  const states = [makeState(src.slice(0, firstIdx), null)];

  for (let k = 0; k < markers.length; k++) {
    const restStart = markers[k].index + markers[k].length;
    const restEnd = k + 1 < markers.length ? markers[k + 1].index : src.length;
    const { via, contentRaw } = parseMarkerSegment(src.slice(restStart, restEnd));
    states.push(makeState(contentRaw, via));
  }

  return states;
}
