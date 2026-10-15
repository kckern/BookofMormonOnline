/**
 * Rows the deeplink campaign is about to open on the reader's behalf.
 *
 * The campaign marks a row and clicks it in the same tick, and the row's open
 * handler asks "was this automatic?" to decide between replacing the URL (a
 * deeplink landing) and pushing it (the reader opened a row). That answer has to
 * be synchronous; it used to live in reducer state, which the click read before
 * the dispatch applied, so campaign opens pushed history entries.
 */
export function createAutoClickTracker() {
  const marked = new Set();
  return {
    mark: (slug) => { marked.add(slug); },
    has: (slug) => marked.has(slug),
    /** True once for a marked row, then forgets it. */
    consume: (slug) => marked.delete(slug),
  };
}
