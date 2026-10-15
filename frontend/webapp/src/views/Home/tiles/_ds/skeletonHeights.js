/**
 * skeletonHeights — loading-skeleton min-heights per tile span class (audit B1).
 *
 * Each value is the tile's rendered height measured live on dev (2026-10-15,
 * scripts/home-audit tileharness, 1440px desktop and 390px phone; median across
 * first-batch and infinite-batch samples), so a cold load reserves the tile's
 * real footprint instead of a generic block that grows on paint.
 *
 * DESKTOP applies to the rail + masonry layout; PHONE overrides the spans whose
 * stacked single-column footprint differs. Anything unlisted falls back to 14rem.
 */
const FALLBACK = "14rem";

const DESKTOP = {
  "tile-readingplan": "233px",
  "tile-narration": "617px",
  "tile-contents": "1000px",
  "tile-community": "213px",
  "tile-people": "810px",
  "tile-text": "330px",
  "tile-commentary": "280px",
  "tile-history": "520px",
  "tile-fax": "630px",
  "tile-faxVerse": "600px",
  "tile-places": "347px",
  "tile-mattersNarrative": "373px",
  "tile-mattersMaterial": "373px",
  "tile-mattersConcept": "373px",
  "tile-biblephrases": "220px",
  "tile-chiasmus": "420px",
  "tile-art": "600px",
  "tile-notes": "440px",
  "tile-mapstory": "650px",
  "tile-personProfile": "330px",
  "tile-placeProfile": "368px",
  "tile-matterProfile": "430px",
  "tile-witness": "195px",
  "tile-josephSmith": "190px",
};

const PHONE = {
  "tile-narration": "384px",
  "tile-contents": "384px",
  "tile-people": "775px",
  "tile-text": "344px",
  "tile-commentary": "290px",
  "tile-history": "450px",
  "tile-fax": "598px",
  "tile-places": "641px",
  "tile-mattersNarrative": "670px",
  "tile-mattersMaterial": "670px",
  "tile-mattersConcept": "670px",
  "tile-chiasmus": "480px",
  "tile-art": "580px",
  "tile-notes": "400px",
  "tile-mapstory": "625px",
  "tile-placeProfile": "322px",
  "tile-witness": "208px",
};

/** CSS length for the skeleton of `spanClass`; `single` = phone single-column layout. */
export function skeletonHeight(spanClass, single) {
  return (single && PHONE[spanClass]) || DESKTOP[spanClass] || FALLBACK;
}
