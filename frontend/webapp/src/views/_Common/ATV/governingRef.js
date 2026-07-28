/**
 * Assign each prose-body apparatus unit its governing scripture reference.
 *
 * Prose units sit under a nested-list citation heading (e.g. "1 Nephi 2:11").
 * Walking the units in document order, a heading found in a unit's preceding
 * context becomes the "current" reference and PERSISTS over the following
 * unit(s) until a new heading appears — mirroring how the list reads. Units
 * before any heading get `null` (the caller renders those label-only).
 *
 * `detectLastRef(contextHtml) -> string | null` is injected so this stays free
 * of scripture-guide and unit-testable in isolation.
 */
export function governingRefs(contexts, detectLastRef) {
  let current = null;
  return contexts.map((ctx) => {
    const ref = detectLastRef(ctx);
    if (ref) current = ref;
    return current;
  });
}
