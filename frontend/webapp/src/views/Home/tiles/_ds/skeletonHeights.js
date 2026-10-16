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
  "tile-narration": "650px", // 4:3 art cells (rail fix) add ~35px
  "tile-contents": "560px", // 2026-10-15 rail fix: pages-only outline (was a 1000px section wall)
  "tile-community": "213px",
  "tile-people": "810px",
  "tile-text": "360px",
  "tile-commentary": "280px",
  "tile-history": "520px",
  "tile-fax": "630px",
  "tile-faxVerse": "600px",
  "tile-places": "347px",
  "tile-mattersNarrative": "373px",
  "tile-mattersMaterial": "373px",
  "tile-mattersConcept": "373px",
  "tile-biblephrases": "320px", // re-measured 2026-10-15 after the Task 10g redesign (6 seeds: 219–395)
  "tile-chiasmus": "400px", // 10g: 6 seeds 311–488 with the ≤600-char filter
  "tile-art": "600px",
  "tile-notes": "440px",
  "tile-mapstory": "650px",
  "tile-personProfile": "330px",
  "tile-placeProfile": "368px",
  "tile-matterProfile": "430px",
  "tile-witness": "225px", // archive pass 2026-10-15: reporter meta line + reveal
  "tile-josephSmith": "190px",
};

const PHONE = {


  "tile-narration": "384px",
  "tile-contents": "384px", // bounded (BoundedTile) on phone
  "tile-people": "775px",
  "tile-text": "385px",
  "tile-commentary": "305px",
  "tile-history": "450px",
  "tile-fax": "650px",
  "tile-faxVerse": "640px",
  "tile-places": "641px",
  "tile-mattersNarrative": "670px",
  "tile-mattersMaterial": "670px",
  "tile-mattersConcept": "670px",
  "tile-biblephrases": "420px", // 10g: pair stacks on phone
  "tile-chiasmus": "400px",
  "tile-art": "580px",
  "tile-notes": "370px",
  "tile-mapstory": "625px",
  "tile-placeProfile": "322px",
  "tile-witness": "240px",
};

/** CSS length for the skeleton of `spanClass`; `single` = phone single-column layout. */
export function skeletonHeight(spanClass, single) {
  return (single && PHONE[spanClass]) || DESKTOP[spanClass] || FALLBACK;
}
