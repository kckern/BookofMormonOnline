/**
 * Derive Map's route params from a react-router 7 splat.
 *
 * v5 gave Map a single Route with an ARRAY of paths, deliberately: one Route
 * means React never unmounts Map when moving between place/story/event/move
 * variants, which would otherwise discard its loaded layers. v7 allows only one
 * path per Route, so the array became `path: "/map/*"` — still a single Route,
 * preserving that property — and the variants are parsed here instead of by
 * path-to-regexp.
 *
 * Shapes, most specific first (matching the old array's order):
 *   /map/:mapType/story/:storySlug/move/:moveSeq
 *   /map/:mapType/story/:storySlug
 *   /map/:mapType/event/:storySlug/move/:moveSeq
 *   /map/:mapType/event/:storySlug
 *   /map/:mapType/place/:placeName
 *   /map/:mapType
 *   /map
 */
export function parseMapPath(splat) {
  const segs = String(splat || "")
    .split("/")
    .filter(Boolean);
  const [mapType, kind, slug, moveWord, moveSeq] = segs;
  const out = {};
  if (mapType) out.mapType = mapType;
  if (kind === "story" || kind === "event") {
    if (slug) out.storySlug = slug;
    // moveSeq was ":moveSeq(\d+)" in v5; keep the numeric check here now that
    // v7 cannot express it in the path.
    if (moveWord === "move" && /^\d+$/.test(moveSeq || "")) out.moveSeq = moveSeq;
  } else if (kind === "place") {
    if (slug) out.placeName = slug;
  }
  return out;
}

export default parseMapPath;
