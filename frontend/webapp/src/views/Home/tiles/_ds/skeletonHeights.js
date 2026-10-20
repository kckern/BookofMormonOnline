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
  "tile-community": "395px", // 2026-10-16 editorial redesign (quote + group rows)
  "tile-people": "810px",
  "tile-text": "360px",
  "tile-commentary": "280px",
  "tile-history": "400px", // R7 2026-10-20 history-A1: floated thumb, 4 seeds 342–427
  "tile-fax": "568px", // R7 fax-A2: pages capped at 200px tall, 4 loads 347–568
  "tile-faxVerse": "510px", // R7 faxVerse-B1: validated crops, 4 seeds 452–548
  "tile-places": "371px", // re-measured 2026-10-16 (places-B1: 3 seeds 371–373)
  "tile-mattersNarrative": "407px",
  "tile-mattersMaterial": "407px",
  "tile-mattersConcept": "407px", // re-measured 2026-10-16 (matters-06),
  "tile-biblephrases": "352px", // R3 B2: a FIXED box — the tile picks the candidate pair that best fills it (textFit) and holds it
  "tile-chiasmus": "440px", // R3 B2: a FIXED box — the tile picks only chiasms estimated to fit (textFit) and holds it
  "tile-art": "604px", // R7 art-B1: ONE frame height (17rem) + fixed excerpt box; 2026-10-20 desktop 604 (one-line title) / 623 (two)
  "tile-notes": "360px", // R3 notes-A1/B2: fixed excerpt box (<=3 verses), 2026-10-16 desktop 338-410
  "tile-mapstory": "662px",
  "tile-personProfile": "330px",
  "tile-placeProfile": "370px", // re-measured 2026-10-16 (CTA row)
  "tile-matterProfile": "440px", // R7 B1: 3:2 hero + plain deck; 2026-10-20 431 (one-line deck) – 451 (two)
  "tile-witness": "225px", // archive pass 2026-10-15: reporter meta line + reveal
  "tile-josephSmith": "190px",
};

const PHONE = {



  "tile-narration": "384px",
  "tile-contents": "384px", // bounded (BoundedTile) on phone
  "tile-people": "865px", // 2026-10-16 people-B1: 3×3 faces + bio + CTA row, 4 loads 851–884
  "tile-text": "385px",
  "tile-commentary": "305px",
  "tile-history": "460px", // R7 history-A1: 4 seeds 394–482
  "tile-fax": "611px", // R7 fax-A2: 4 loads all 611
  "tile-faxVerse": "640px", // R7: 4 seeds 553–732
  "tile-places": "677px", // re-measured 2026-10-16 (places-B1: 665–689 with the touch chip padding)
  // R7 (2026-10-20): the eyebrow heading holds its own 44px touch hit (+14px);
  // phone seeds Narrative 733–746, Material 720–733, Concept 746, Profile 432–434
  "tile-mattersNarrative": "740px",
  "tile-mattersMaterial": "730px",
  "tile-mattersConcept": "746px",
  "tile-matterProfile": "434px",
  "tile-biblephrases": "414px", // R3 B2: fixed box (pair stacks on phone; 9 text rows + one row of slack)
  "tile-chiasmus": "440px", // R3 B2: fixed box, fit-filtered (76 of 118 fit at 334px, 55 at 314px)
  "tile-art": "623px", // R7 art-B1: fixed frame, 2026-10-20 phone + tablet all 623 (one-line titles)
  "tile-notes": "390px", // R3 notes-A1/B2: fixed excerpt box, 2026-10-16 phone 356-482
  "tile-mapstory": "655px",
  "tile-placeProfile": "377px", // re-measured 2026-10-16 (placeProfile-B1)
  "tile-witness": "240px",
  "tile-community": "446px", // 2026-10-16 editorial redesign
};

/** CSS length for the skeleton of `spanClass`; `single` = phone single-column layout. */
export function skeletonHeight(spanClass, single) {
  return (single && PHONE[spanClass]) || DESKTOP[spanClass] || FALLBACK;
}
