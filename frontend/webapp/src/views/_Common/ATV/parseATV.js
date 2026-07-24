/**
 * Pure parser for Royal Skousen's Analysis of Textual Variants apparatus.
 * No DOM, no React, no I/O — string in, plain data out. Reference tables live
 * in apparatus.js.
 */

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
