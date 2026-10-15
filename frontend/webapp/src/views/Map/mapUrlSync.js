/**
 * Map URL sync helpers (audit R2.2 E1: one Back = one history entry).
 *
 * Near East places (location "W") live on the "neareast" map; every other
 * place lives on an internal map. A place deeplinked onto the wrong map is
 * redirected by MapPanel, and that redirect is a canonicalization, so it
 * replaces rather than pushes.
 */
export const isPlaceOutOfMapScope = (mapSlug, placeLocation) =>
  placeLocation != null && (mapSlug === "neareast") !== (placeLocation === "W");

/**
 * The URL MapPanel should mirror for the open place, or null when it must not
 * touch the URL: no map loaded yet, a story URL is canonical, or the place is
 * out of the current map's scope (a redirect to the right map is in flight).
 */
export function placeUrlSyncTarget({ mapSlug, slug, onStoryUrl, placeLocation }) {
  if (!mapSlug || onStoryUrl) return null;
  if (!slug) return `/map/${mapSlug}`;
  if (isPlaceOutOfMapScope(mapSlug, placeLocation)) return null;
  return `/map/${mapSlug}/place/${slug}`;
}
