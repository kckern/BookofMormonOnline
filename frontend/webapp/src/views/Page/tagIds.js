// Inline supplement tags look like [i]123[/i] (art) and [c]123[/c]
// (commentary). Returns deduped id strings in first-seen order.
export function extractTagIds(tag, ...texts) {
  const re = new RegExp(`\\[${tag}\\](\\d+)\\[\\/${tag}\\]`, "gi");
  const ids = [];
  for (const text of texts) {
    if (typeof text !== "string") continue;
    for (const m of text.matchAll(re)) ids.push(m[1]);
  }
  return [...new Set(ids)];
}
