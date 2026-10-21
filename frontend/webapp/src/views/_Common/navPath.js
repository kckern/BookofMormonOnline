/**
 * The path the navs (sidebar, bottom bar) should treat as "where the reader is".
 *
 * A popup writes its own URL (/places/<slug>) natively, behind the Router, but
 * the page underneath is unchanged. Highlighting the browser path made the nav
 * claim Places / Study over a place popup on Discover; while a popup is open
 * the page beneath it (underSlug) is the answer.
 */
export function navPath(states, loc = window.location) {
  const popUp = states?.popUp;
  if (popUp?.open && popUp.underSlug) return `/${String(popUp.underSlug).replace(/^\/+/, "")}`;
  return loc.pathname;
}
