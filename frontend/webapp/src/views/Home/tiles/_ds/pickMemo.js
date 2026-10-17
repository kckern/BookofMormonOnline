/**
 * pickMemo — a module-scope memo of a self-fetching tile's resolved pick.
 *
 * Self-fetching tiles (BiblePhrases, Chiasmus) used to remount in `loading`
 * on every Back: the fixed-height skeleton replaced the content in view and
 * then re-filled at a different height (audit XC2). The pick is a pure
 * function of (seed, language), so the first resolution is remembered for the
 * life of the page and a remount renders it synchronously. Only definitive
 * outcomes are stored (a pick, or "nothing displayable"); a failed fetch is
 * not, so the next mount retries.
 */
export function createPickMemo(max = 200) {
  const map = new Map();
  return {
    get: (key) => map.get(key),
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      if (map.size > max) map.delete(map.keys().next().value);
    },
    clear: () => map.clear(),
  };
}
