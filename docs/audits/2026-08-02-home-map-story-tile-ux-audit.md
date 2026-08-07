# Home `MapStoryTile` UX Effectiveness Audit

**Date:** 2026-08-02

**Live route:** `https://bom.kckern.net/home`

**Scope:** The animated map-story card rendered by `MapStoryTile.js`,
`MapStoryTileInner.js`, and `MapStoryCard.js`, including sampler placement,
backend story selection, styling, accessibility, and continuation into `/map`.

**Trigger:** Users report that the tile is ugly, confusing, and useless.

**Decision:** **The reports are valid. Temporarily remove the current tile from
Home, then rebuild it as a map-first animated story with persistent place
labels, moving participant avatars, collision-aware clustering, semantic
progressive reveal, and an exact-story handoff.** A compact static rendering is
the reduced-motion and load-failure fallback, not the primary ambition.

**Confidence:** High. The user supplied a live screenshot of the reported card,
and its visible structure matches the checked-in component and CSS exactly.

### Implementation follow-up — 2026-08-02

The replacement recommended by this audit has now been implemented in the
working tree. The findings below remain a point-in-time evaluation of the
original screenshot and renderer; they should not be read as a description of
the replacement.

The replacement now provides:

- readable place names retained in the journey model;
- a faint persistent whole-route silhouette, accumulated visited legs, and a
  clearly emphasized active leg;
- priority-based, screen-space label placement with leader lines;
- deterministic marker/cluster displacement for distinct places that project
  into the same pixels, with geographic leader lines instead of stacked dots;
- deterministic clustering of lower-priority future places, with active and
  anchor places exempt;
- one or two representative traveler avatars, plus `+N`, moving on the active
  leg with collision-aware placement and a live connector when the party must
  be displaced far enough to otherwise look geographically detached;
- clickable, keyboard-focusable place labels that jump directly to the most
  relevant story move;
- a visible `Move X of N` state, previous/next buttons, a labeled scrubber, and
  44px playback targets instead of ambiguous dots;
- bounded autoplay that holds on a composed completed route instead of looping;
- pause-on-map-manipulation, a recenter action, viewport gating, document-hide
  pause, and keyboard-focus pause;
- a no-autoplay completed-route experience for reduced motion;
- a semantic text equivalent and a composed static renderer-failure fallback;
- exact-story links to `/map/internal/story/${data.slug}`;
- an explicit Home-title correction from “Recolonization Noah” to “Noah’s
  Recolonization” pending editorial data support.

Targeted unit coverage passes **46 tests across three suites**; the complete
frontend suite passes **790 tests in 103 suites** (six unrelated tests are
skipped). A controlled headless-Chrome fixture pass verified light, dark,
mobile, wide-card, and reduced-motion states at 313px, 341px, and 392px rendered
card widths. The dense fixture deliberately gives two distinct places the same
coordinate. Static, animated, completed, and manipulated-map frames report
zero label, marker, cluster, or traveler collisions and zero out-of-frame
symbols. The same pass verifies cluster-to-move selection, named-place-to-move
selection, actual changing traveler coordinates, displacement connectors,
drag-to-pause, recenter recovery, a final-position reduced-motion scrubber, and
navigation to the exact story URL.

Browser QA found and fixed lifecycle and layout defects that unit tests alone
did not expose: transient null OpenLayers pixel coordinates during mount,
stale/incorrect traveler placement after fit and in the completed state,
content-box label dimensions diverging from collision boxes, and dense-frame
traveler displacement that was collision-free but visually detached.

The live URL currently returns HTTP 200 and renders the application shell, but
a clean headless session remained on its loading state and never mounted the
Home tile. The localhost proxy likewise receives HTTP 400 for the current
production compound sampler query. Replacement QA therefore used the real
local application with intercepted, schema-accurate sampler data. Production
API compatibility and a deployment smoke test remain release gates rather than
being treated as frontend successes. The public legacy map API also currently
rejects its `mapstories(map: "internal")` query with `Unknown column
'BomMapStory.prev' in 'field list'`; that independent deployed-schema failure
must be resolved for the exact-story destination to load in production.

Post-change expert re-evaluation:

| Dimension | Before | Replacement | Notes |
|---|---:|---:|---|
| First-glance comprehension | 0/3 | 3/3 | Named anchors, route context, counts, and current move are immediate. |
| Visual hierarchy | 1/3 | 2/3 | Map-first composition is coherent; final judgment still needs real-story production screenshots. |
| Spatial legibility | 0/3 | 3/3 | Priority labels, clusters, leader lines, and traveler collision handling are implemented and tested. |
| Interaction clarity | 1/3 | 3/3 | Labeled state, large controls, scrubber, and recenter replace implicit dots. |
| Progress clarity | 0/3 | 3/3 | Moves and places are named as different units. |
| Progressive disclosure | 0/3 | 3/3 | Future places cluster; active and visited geography is promoted and retained. |
| Narrative efficiency | 0/3 | 3/3 | Eight moves complete within the 22-second budget and hold on the overview. |
| Exact-story continuation | 0/3 | 3/3 | Title and CTA preserve the story slug. |
| Accessibility | 1/3 | 3/3 | Text equivalent, labeled range, focus states, target sizes, and reduced-motion completion are present. |
| Performance/reliability | 1/3 | 2/3 | Map mounting is intersection-gated and failures compose; production API/load remains unresolved. |

Remaining product work is deliberately outside this frontend rewrite: curate
Home-quality story titles/synopses in data, add funnel instrumentation, decide
whether entity deep links belong in the compact card, resolve the production
Home API/loading failure, and run the final deployed visual matrix against the
densest real eligible stories.

#### Frontend completion evidence matrix

| User/UX requirement | Status | Authoritative evidence |
|---|---|---|
| Retain key place labels | Complete | Active endpoints and story anchors are mandatory; visited labels persist when space permits; the completed eight-place fixture exposes every name. |
| Show representative people moving | Complete | Up to two real participant avatars plus `+N` use the same interpolation clock as the active route; browser coordinates change during playback. |
| Prevent collisions | Complete for supported card states | Pure tests cover labels, symbols, controls, and dense edge placement; browser geometry reports zero overlaps for static, moving, dark, mobile, 392px, reduced-motion, and deliberately co-located-place frames. |
| Cluster nearby future places | Complete | Deterministic screen-space clusters exclude active/anchor places, display `N places`, and navigate to the earliest represented move. |
| Use semantic progressive reveal | Complete | Full-route silhouette is immediate; active and visited legs accumulate; future detail clusters; completion reveals the full named route and holds. |
| Make the map meaningfully interactive | Complete | Users can drag/zoom, pause, recenter, select clusters, select named places, scrub, step, play, and replay. Direct map manipulation pauses storytelling. |
| Make the tile understandable at a glance | Complete | Human title, `moves · places`, named active route, scripture context, participant text, legend, and exact-story CTA are present before waiting for later beats. |
| Avoid ambiguous/tiny progress dots | Complete | Visible `Move X of N`, 44px previous/play/next controls, and a labeled range input replace the dots. |
| Bound autoplay and stop looping | Complete | The eight-move target completes in 22 seconds and holds a useful completed state until deliberate replay. |
| Support reduced motion | Complete | Initial state is a static completed named route with no autoplay/content churn; slider and accessible text both reflect the final state. |
| Preserve story context on handoff | Complete in the frontend | Title/CTA target `/map/internal/story/${data.slug}`; browser navigation reaches that exact URL. The deployed API failure described above remains external. |
| Degrade safely | Complete | Invalid geometry is filtered; map mounting is viewport-gated; suspense/error states render a composed origin-to-destination fallback; transient map pixels and failed avatars do not crash Home. |

---

## Correction: which component users are seeing

The reported card is **not** `frontend/webapp/src/views/Home/tiles/MapTile.js`.
It is `MapStoryTile.js`.

The live screenshot identifies it unambiguously:

- story title: “Recolonization Noah”;
- numbered map stops;
- animated dashed leg;
- pause button;
- current move card with place artwork, scripture reference, prose, and people;
- a row of step dots;
- “View more” CTA.

Only `MapStoryTile` renders that combination. The older `MapTile` is a separate,
rare reserve filler containing only a base map. An earlier version of this audit
followed the filename in the initial report and evaluated that older component.
It has been replaced by this document so the decision addresses the actual UI.

The old `MapTile` is still a valid cleanup candidate, but it is not the card
shown in the supplied screenshot and is not the subject of this audit.

---

## Executive summary

The tile contains potentially valuable content, but packages it in a form that
is difficult to understand, slow to reveal its story, visually oversized, and
poor at continuing the user into the full map experience.

The screenshot’s story contains eight moves across seven distinct places. The
card displays:

- seven numbered circles on the map;
- nine tiny progress dots below the move card: eight moves plus a summary;
- only the first leg and first move’s text at the captured moment;
- a generic “View more” destination that opens `/map`, not this story.

Those are three different information models on one card:

1. **places** numbered on the map;
2. **moves** represented by the carousel;
3. **moves plus summary** represented by the dots.

The UI never explains the distinction. A user reasonably expects marker 7 and
dot 7 to refer to the same thing, but that relationship is not guaranteed.
Revisited places and discontinuous moves make the mismatch structural, not
cosmetic.

The animation compounds the problem. Each move takes 5.5 seconds: a 1.5-second
line draw plus a 4-second dwell. For the eight-move live example, the summary
does not appear until approximately **44 seconds** after the tile starts, and a
full loop takes **47.5 seconds**. Most Home-page visitors will never receive the
overview needed to understand what they are watching.

The final funnel is broken as well. `data.slug` is available and the app
supports `/map/internal/story/:storySlug`, but both visible map links go to the
generic `/map`. A user who becomes interested in “Recolonization Noah” loses
that context on the very click intended to continue the experience.

This is why the card can feel useless despite containing real information. It
demands substantial attention, then fails to carry the selected subject
forward.

### Recommendation in one line

Remove the current card from `FIXED_TAIL` while it is reworked. Bring it back as
an animated map story in which place names persist, representative people move
with the active journey leg, nearby features declutter or cluster, visited
context accumulates, future information is introduced intentionally, and the
CTA opens `/map/internal/story/${data.slug}`.

---

## 1. Audit method and evidence limits

This evaluation used:

- the user-provided screenshot captured from the live Home experience;
- a complete read of `MapStoryTile.js`, `MapStoryTileInner.js`,
  `MapStoryCard.js`, and `mapStoryPath.js`;
- all `.mapStory*` and shared `.mapTile*` styling in `Sampler.css`;
- sampler placement and render ordering in `Sampler.js`;
- the backend `sampleMapStory` selection and response shape;
- full-map routing and story deep-link support;
- the component and path-helper tests;
- the original static and animated map-story design documents;
- git history for both the old map tile and the newer story tile.

The in-app interactive browser runtime was unavailable. A live-page scraping
fallback was attempted but its service account had no remaining credits. The
original-state visual review therefore uses the supplied live screenshot. The
replacement was independently exercised in the repository's local application
with installed headless Chrome and intercepted sampler data, as documented in
the implementation follow-up above. No click analytics, scroll-depth data,
session recordings, or structured interview transcripts were supplied.

Claims about exact visual structure, counts, timing, routing, and interactions
are directly verified. Claims about aesthetic reaction explain the reported
feedback but remain expert interpretation rather than quantified preference
research.

---

## 2. What the current tile does

`MapStoryTile` is a once-per-Home-load animated feature card. Given a sampled
story, it:

1. displays the generic category “Map”;
2. displays the database story title;
3. builds a live OpenLayers map of every move and distinct place;
4. automatically draws one journey leg;
5. shows the corresponding move card;
6. waits, then advances to the next move;
7. shows a summary card only after the final move;
8. loops back to the beginning;
9. offers tiny dots to pin a move or summary;
10. links generically to `/map`.

The flow for the screenshot’s eight-move story is:

```text
move 1: draw 1.5s + dwell 4s
        ↓
move 2: draw 1.5s + dwell 4s
        ↓
... six more moves ...
        ↓
summary: dwell 3.5s
        ↓
restart at move 1

total loop: (8 × 5.5s) + 3.5s = 47.5s
```

Playback starts automatically when at least 40% of the tile intersects the
viewport. The tile is fixed at the end of the first masonry batch and is not an
infinite-feed repeat.

---

## 3. Product goal versus delivered experience

### Home sampler goal

The Home sampler is meant to expose one concrete taste of each content type so
a user can recognize something interesting and click into it.

### Map-story concept goal

A successful journey preview should quickly answer:

- What journey is this?
- Where does it begin and end?
- Why does it matter in the scripture narrative?
- How large or complex is it?
- How do I explore this exact journey in detail?

### What the current card answers

- It names the story, although the live title is not plain language.
- It shows the current move.
- It reveals other moves only over time or through tiny unlabeled controls.
- It never provides a stable route overview before playback begins.
- Its CTA does not open the exact journey.

The tile behaves like a tiny automated presentation. The Home page needs a
recognizable preview and a strong handoff.

---

## 4. UX effectiveness scorecard

Scores are qualitative: **0 = fails**, **1 = weak**, **2 = adequate**, **3 =
strong**. They are not engagement analytics.

| Dimension | Score | Evidence |
|---|---:|---|
| Content substance | 2/3 | Real places, scripture references, descriptions, and participants are present. |
| First-glance comprehension | 0/3 | Abstract map, unexplained numbers, awkward title, and no overview. |
| Visual hierarchy | 1/3 | The map dominates nearly half the card while the story’s meaning is fragmented below it. |
| Spatial legibility | 0/3 | No place labels, collision pass, clustering, displacement, or active-feature priority. |
| Interaction clarity | 1/3 | Pause is visible, but map gestures, dots, ref button, category link, and CTA compete. |
| Progress clarity | 0/3 | Seven place markers versus nine move/summary dots in the live example. |
| Progressive disclosure | 0/3 | Future stops appear without connections while labels and participant state never accumulate. |
| Narrative efficiency | 0/3 | The overview arrives after ~44 seconds for the captured story. |
| Continuation into `/map` | 0/3 | CTA discards the sampled story and opens the generic map. |
| Entity usefulness | 1/3 | Places and people are visible but are not linked to their detail views. |
| Accessibility | 1/3 | Pause and ARIA labels exist, but canvas meaning, tiny targets, and auto-updating prose remain weak. |
| Performance efficiency | 1/3 | Sensible lazy-image work exists, but the live map and multiple assets are expensive for a poor funnel. |
| Distinct product value | 2/3 | A scripture journey preview is distinctive and worth preserving in a better form. |

**Overall verdict: the concept is valuable; the current implementation fails.**

This distinction matters. The old `MapTile` has almost no content proposition
and should simply be retired. `MapStoryTile` has good underlying data and should
be redesigned rather than permanently deleted.

---

## 5. Visual review of the supplied live screenshot

The captured card is approximately 394 CSS pixels wide at a 2× device scale.
That matches a desktop masonry column. The visible card is roughly 580 CSS
pixels tall, with a 260px map frame: the map alone occupies about 45% of the
card’s height.

### 5.1 The map reads as an abstract diagram without a legend

The base layer is composed of large muted green shapes, a small blue patch, and
a cream corner. It provides no visible place names, terrain labels, compass,
scale, or model explanation. Seven numbered circles float across it.

Only stops 1 and 2 and their dashed red line explain the active move. Stops 3–7
have no visible relationship until their turn arrives. At first glance the map
resembles a numbered puzzle or constellation more than a scripture journey.

### 5.2 The route is less visible than the stops

The view is fitted to the whole story, but future legs are hidden. This produces
a large map showing all destinations while revealing only one connection. The
user sees the complexity without seeing the structure that would explain it.

A preview should normally do the reverse: show the complete route lightly,
then emphasize the selected leg if selection is useful.

### 5.3 Key place names are discarded at the map boundary

The backend already returns `startName` and `endName`, and the move card proves
that readable names such as “City of Nephi” and “Place of Mormon” are
available. `stopsOf()` drops those names and retains only slug, coordinates, and
step indexes. `stopStyle()` then renders only an ordinal inside a circle.

This is a major waste of the map’s most important semantic data. The user must
look below the map to decode stops 1 and 2, and cannot decode stops 3–7 at all.
Key labels should survive the whole animation, with priority given to the story
origin, current start/destination, final destination, and previously revealed
anchors.

### 5.4 Exact-place deduplication is not collision detection

`stopsOf()` correctly merges repeated visits to the same slug. That prevents
exact duplicates from stacking at identical coordinates, but does nothing for
different places whose projected pixels overlap or whose labels compete at the
current fitted zoom.

The OpenLayers `VectorLayer` is created without decluttering. There is no
screen-space collision pass, cluster source, label priority, displacement,
spiderfy behavior, or zoom-dependent simplification. The live map happens to
show seven separated circles, but the architecture has no answer when two
distinct places are close together.

The absence of a collision system also explains why readable place labels were
probably omitted: adding them naively would expose overlaps. Removing meaning
is not a substitute for solving layout.

### 5.5 People are visually detached from the journey they explain

Representative participant data is already available per move, but it is
rendered as a small avatar list beneath the map. The people do not occupy the
active origin, travel with the animated line, arrive at the destination, or
remain associated with the route.

This splits the story into an abstract geometry panel and a separate metadata
panel. One or two representative avatars, plus a `+N` group badge when needed,
could turn the route animation into a legible account of who moved where.

### 5.6 The current reveal is geometric, not semantic

The implementation technically reveals the current line over time, but it
shows every future stop marker at once, hides every future connection, and
never reveals place names on the map. Past legs remain as dim geometry, yet no
visited-place label or participant state accumulates.

Effective progressive reveal should manage meaning:

- establish the important anchors;
- introduce the active people and origin;
- animate the current move;
- retain the destination label and visited route;
- cluster or suppress low-priority future detail;
- reveal the next beat only when the current beat is understood.

The current version animates pixels without progressively building a mental
model.

### 5.7 The title is not editorially ready

“Recolonization Noah” reads like an internal taxonomy or two keywords placed
next to each other. It does not state who acted, what was recolonized, or why the
journey matters. Possible human-readable forms might be “Noah’s Recolonization”
or “The Land Is Recolonized under King Noah,” but the correct title requires an
editorial decision, not automatic word rearrangement.

The backend only requires two moves with complete coordinates. It does not
apply a title-quality, description-quality, length, or narrative-completeness
filter before selecting a story for the Home page.

### 5.8 The move card is denser than its hierarchy suggests

The card below the map contains:

- an 84px place image;
- start and end place names;
- two scripture ranges;
- a multi-line narrative description;
- two participant avatars and names.

All are legitimate data, but they are presented at similar visual strength.
The place image is decorative in behavior, the participants are dead ends, and
the reference is the only locally actionable content. The user has to parse a
lot to learn that the active event is simply “City of Nephi → Place of Mormon.”

### 5.9 The card reserves blank height for invisible slides

Every move and summary slide occupies the same CSS grid cell. Inactive slides
are transparent and pointer-disabled, but they still participate in grid track
sizing. The stage therefore takes the height of the tallest slide, not
necessarily the active slide.

This explains the conspicuous blank area between the visible participant row
and the progress dots in the supplied screenshot. A different story or active
move can reserve even more unexplained whitespace if another hidden card has a
longer description.

### 5.10 The bottom controls are visually detached

The tiny progress dots sit at the far left; “View more” sits at the far right
and bottom. The space between them is large, and there is no “1 of 8” label,
route summary, or shared toolbar binding them together.

The result looks unfinished because the controls do not form one understandable
navigation system.

---

## 6. Why users reasonably call it “ugly”

The complaint is explained by composition more than by color choice:

- the card is unusually tall for one Home item;
- the largest region is a low-detail, unlabeled map;
- numbers dominate where human-readable place names should orient the user;
- a realistic scenic image is juxtaposed with a flat abstract map without a
  clear relationship;
- hidden carousel slides create visible blank space;
- the title reads like unedited data;
- progress dots and CTA are stranded at opposite corners;
- the generic shared tile chrome is too slight for an embedded application.

Changing border radii, shadows, or colors will not resolve these structural
issues.

---

## 7. Why users reasonably call it “confusing”

### 7.1 Place numbers and progress dots count different things

The screenshot has seven numbered place markers and nine dots. The code makes
this expected:

- `stopsOf(moves)` deduplicates places, so map markers represent distinct
  places;
- the carousel has one slide per move;
- the dots have one control per move plus one summary control.

When a journey revisits a place, jumps between discontinuous moves, or contains
more moves than unique destinations, the units diverge further. The UI provides
no legend or terminology to explain the mismatch.

### 7.2 The user cannot see the story shape

Future stops are visible but future legs are hidden. The title describes a
whole story while the map shows only one connection. The summary that might
explain the whole story appears at the end of a long automatic sequence.

The unlabeled future markers are also disclosed too early. They consume the
limited visual field before the story has given them identities or
relationships. At the same time, the labels needed to understand the current
beat are never drawn. This is progressive disclosure in the wrong order.

### 7.3 Overlap behavior is undefined

The map fits the whole story into a fixed 260px frame, so screen-space distance
changes with every story extent. Two places that are geographically distinct
can collapse into the same small patch. Because there is no collision
detection, clustering, or label priority, a user cannot know whether a missing
or unreadable marker is absent data, an overlapped feature, or the current stop
covering another stop.

### 7.4 The card mixes five interaction models

The user can:

- pan/zoom the OpenLayers surface through implicit gestures;
- pause/play with an icon button;
- pin a step with a tiny dot;
- open scripture through underlined button text;
- navigate generically through “Map” or “View more.”

The story title, place image, place names, avatars, and participant names are
not links. The content that looks most concrete is inert, while the category
and generic CTA navigate.

### 7.5 Manual selection silently changes playback mode

Clicking a dot sets `paused = true` and pins that step. This is defensible, but
the dots are so small and unlabeled that the relationship between selection and
the pause state is not visually taught. The design specification also says
clicking a card should pause and pin it; the implementation only wires this
behavior to the dots.

### 7.6 The pause icon is clearer to assistive technology than visually

The button has a good dynamic accessible name (“Pause journey” / “Play
journey”), but uses text glyphs `❚❚` and `▶` for its visible icon. In the
screenshot the pause glyph reads as a small blocky symbol without the refinement
of the rest of the card.

---

## 8. Why users reasonably call it “useless”

The tile does contain useful facts, so “useless” is best understood as a task
and funnel failure.

### 8.1 “View more” loses the selected story

`MapStoryTile` receives `data.slug`, and the router supports:

```text
/map/:mapType/story/:storySlug
```

But the heading and CTA both use `/map`. The primary action should be:

```js
`/map/internal/story/${data.slug}`
```

This is the most consequential defect. The tile previews a specific subject,
then refuses to open that subject.

### 8.2 The preview does not help the user decide quickly

For the live example, a visitor must stay with the card for about 44 seconds to
reach the summary naturally. A Home tile should communicate enough value in
roughly one glance to justify a click.

### 8.3 Visible entities are not explorable

The current move exposes a destination image, two place names, and participant
avatars. None link to `/places/:slug` or `/people/:slug`. This contradicts the
Home sampler’s normal pattern of turning concrete entities into exploration
paths.

### 8.4 The map’s local interaction has no durable outcome

Users may pan, pinch, or double-click the map, but cannot select its markers or
open a place. If they pan away, subsequent animated legs continue against the
altered view and there is no recenter control. Local manipulation does not
advance the study task.

### 8.5 The tile is mandatory when its payload is ready

`mapstory` is in `FIXED_TAIL`, so it is appended once at the end of the first
masonry batch whenever the sampled story has at least two moves. It is not
selected because the story is especially relevant or high quality.

This is significant: the card is not a rare experiment. It is a fixed feature
slot fed by a sampler whose main quality gate is coordinate completeness.

---

## 9. Detailed findings by severity

### P0 — The CTA discards story context

**Evidence:** Both links in `MapStoryTile.js` use `/map`; `data.slug` is
available; story routes are implemented in `Routes.js`.

**Impact:** Interest generated by the card is not carried into the destination.
The user must relocate the story manually, if they can find it.

**Fix:** Link the story title and primary CTA to
`/map/internal/story/${data.slug}`. Label the CTA “Explore this journey,” not
“View more.” Keep a small generic “Map” category link only if needed.

### P0 — Autoplay withholds the overview for too long

**Evidence:** 5.5 seconds per move, summary after the last move, continuous
loop. The live story has eight moves.

**Impact:** Users see a fragment without understanding the whole. The card asks
for presentation-length attention inside a scanning surface.

**Fix:** Establish the whole-story frame immediately, then run a shorter,
controllable sequence. The initial state must show title, key anchors, faint
route context, counts, and the exact-story action before any motion begins.

### P0 — Progress is represented with incompatible units

**Evidence:** Map markers represent distinct places; dots represent moves plus
summary. Screenshot: 7 markers, 9 dots.

**Impact:** Users cannot form a stable mapping between control, marker, and move.

**Fix:** Eliminate the dot-only control. Show honest metadata such as “8 moves ·
7 places” and a visible “Move 1 of 8” control if scrubbing remains. Map labels
should identify places by name rather than requiring ordinal lookup.

### P0 — The semantic map layer is missing

**Evidence:** `stopsOf()` drops place display names; `stopStyle()` renders only
numbers; the vector layer has no declutter configuration; there is no cluster
or screen-space collision logic.

**Impact:** The map cannot explain itself and cannot safely add the labels it
needs. Exact repeated-place deduplication prevents one special overlap case but
leaves all nearby distinct-place collisions unsolved.

**Fix:** Carry place names into stop features and implement a priority-driven
layout system:

1. active origin/destination labels always win;
2. story origin and final destination are next;
3. visited key places persist;
4. nearby low-priority stops cluster at the fitted zoom;
5. future detail is suppressed or clustered until reveal;
6. labels use OpenLayers decluttering plus explicit fallback displacement;
7. active features may temporarily de-cluster or spiderfy when necessary.

### P0 — Progressive reveal exposes clutter before meaning

**Evidence:** Every distinct stop marker is present from the beginning, future
legs are hidden, labels are never rendered, and visited state accumulates only
as dim line geometry.

**Impact:** Users see unexplained destinations up front and receive semantic
context too late. The animation reveals drawing operations rather than a story.

**Fix:** Begin with key anchor labels and a faint whole-route silhouette. On
each beat, reveal the active participants and route, retain the destination
label and visited segment, and introduce the next relevant cluster only as the
story approaches it.

### P1 — Participant data is detached from the animation

**Evidence:** Move travelers are available in `move.people`, but render only in
the lower prose card.

**Impact:** The user watches anonymous geometry while the characters who make
it a story sit elsewhere in the layout.

**Fix:** Render a map-bound travel party: one or two representative circular
avatars moving along the active leg, plus a compact `+N` badge for larger
groups. On arrival, dock the party at the destination or transition it into the
next leg. Keep a textual participant list as the accessible equivalent.

### P1 — The card lacks a stable full-story view

**Evidence:** Later legs are hidden until played; only the title card shows a
summary; future markers remain visible.

**Impact:** The map shows unexplained destinations without the route that makes
them meaningful.

**Fix:** Render all valid legs initially as a subdued route silhouette. Animate
the active leg above it, retain visited legs, and progressively reveal labels
and people without erasing overall context.

### P1 — The story inventory is not Home-quality filtered

**Evidence:** Backend eligibility requires at least two coordinate-complete
moves. The live title is “Recolonization Noah.” No checks require a strong
title, summary, reference, bounded move count, or complete imagery.

**Impact:** Internal or awkward records can become prominent Home features and
remain session-stable.

**Fix:** Add an explicit `home_featured`/quality field or curate an allowlist.
Do not attempt to infer editorial quality from string length alone.

### P1 — Hidden slides control visible height

**Evidence:** All slides occupy one CSS grid area and remain in layout.

**Impact:** Short active cards inherit blank space from the longest invisible
card, producing inconsistent and apparently broken spacing.

**Fix:** Make the map the primary story canvas and reduce the lower region to a
compact, fixed-height current-beat caption. If an interim carousel remains,
size the stage to the active slide or use intentional clamping.

### P1 — High-value entities are dead ends

**Evidence:** Place and participant elements render as `<div>`, `<img>`, and
`<span>`, not links.

**Impact:** The tile displays the site’s best exploration hooks without making
them useful.

**Fix:** A compact preview should prioritize the story-specific CTA. If entity
links remain, link place names to `/places/:slug` and people to
`/people/:slug`, taking care to avoid an over-interactive card.

### P1 — Accessibility is incomplete

**Evidence:** 7×7px dot buttons, no visible dot labels, no map-canvas name or
textual full-route equivalent, automatically updating `aria-live` prose, and no
explicit focus treatment for dots.

**Impact:** The step controls are extremely difficult for touch and
low-dexterity users. Screen-reader users receive changing move content without
an immediately available whole-story summary.

**Fix:** Replace dots with a labeled scrubber or previous/next controls using
44×44px targets, clear focus indicators, and visible current/total text.
Expose the route and participant summary in ordinary text rather than relying
on canvas features.

### P2 — The embedded map offers low-value interaction

**Evidence:** Default OpenLayers interactions remain, controls are removed,
mouse-wheel zoom is disabled, and markers have no click handlers.

**Impact:** Users can alter the viewport but cannot select a destination or
recover the fitted view.

**Fix:** Give interaction a clear boundary. Prefer animation controls and marker
selection over free pan/zoom in the Home card; if pan remains, add recenter and
prevent automatic storytelling from continuing offscreen. The static fallback
must remain understandable without gestures.

### P2 — Loading and asset failure are not composed

**Evidence:** Suspense shows only an ellipsis. Failed place/people images are
hidden while their reserved containers/names remain. Raster tile errors have no
card-level state.

**Impact:** Partial failures can create blank art blocks or an unexplained map
area.

**Fix:** Provide a designed static fallback and omit failed media containers,
not just the `<img>`.

---

## 10. Accessibility review

### What is good

- Autoplay has a pause/play control with a dynamic accessible name.
- Manual dot selection sets `aria-current="step"`.
- Inactive slides are `aria-hidden`, avoiding simultaneous reading of every
  move.
- The stage uses `aria-live="polite"` rather than assertive announcements.
- horizontal slide motion is removed under `prefers-reduced-motion`.
- playback is gated by viewport visibility.

These are thoughtful and should be acknowledged.

### What still fails the experience

#### Tiny controls

`.mapStoryDot` is 7×7px with no padding. It is far below the WCAG 2.2 AA target
minimum of 24×24 CSS pixels and common 44×44 touch guidance. Nine adjacent dots
also provide little separation for users with tremor or low vision.

#### Canvas semantics

Numbered stops and route geometry exist only in the visual map. The active move
card is a partial text equivalent, but there is no immediately available text
summary of all moves and places.

#### Automatic live-region churn

Every auto-advance swaps the active text inside a polite live region. For a
long story, assistive technology may announce repeated multi-line updates over
nearly a minute. The pause control technically exists, but the default remains
high cognitive and auditory churn.

#### Reduced motion is not reduced updating

The motion preference disables line growth and horizontal travel, but
auto-advance continues. That matches the original spec, yet it does not address
users whose need is reduced distraction or more reading time rather than only
reduced animation.

#### Generic links

“Map” and “View more” are weak accessible names for a specific journey. “Explore
Recolonization under Noah” or “Explore this journey” would preserve context.

**Accessibility verdict:** several mechanisms were implemented responsibly,
but the auto-carousel concept creates problems those mechanisms cannot fully
solve on Home.

---

## 11. Performance and reliability

### Existing strengths

- OpenLayers is code-split through `React.lazy`.
- Playback stops while the tile is offscreen.
- Only active and neighboring slide imagery is rendered.
- Avatars are capped at four.
- Images use `loading="lazy"`.
- the map is cleaned up on unmount;
- move geometry is built once per story;
- per-leg features avoid fabricated paths;
- repeated places are deduplicated into one marker;
- invalid extents are guarded before `view.fit()`.

The implementation is technically much better than the UX result suggests.

### Remaining cost problem

The source comments document place images around 358–399 KB and avatars up to
233 KB. The active window can still load multiple place and person assets in
addition to OpenLayers and raster map tiles. Because `MapStoryTile` is fixed in
the first batch, this cost is incurred whenever the payload is ready and the
component renders, even if playback is initially offscreen.

Code splitting defers the map runtime until render, not until intersection. The
`IntersectionObserver` gates timers but does not gate `MapStoryTileInner` mount
or map-tile requests.

The rebuilt version should gate the OpenLayers mount itself on intersection,
preload only the next beat’s representative avatars, request purpose-sized
assets, and fall back to one pre-rendered story image when live rendering or
motion is unavailable.

---

## 12. What is worth keeping

The redesign should preserve the work that makes the underlying data reliable:

- one geometric feature per move;
- no invented connections across discontinuities;
- one marker per distinct place;
- display names instead of raw slugs;
- scripture reference and narrative description;
- honest traveler data;
- enough participant data to animate representative travelers on the map;
- fitted full-story extent;
- finite-coordinate guards;
- story-specific seed stability;
- a path into the full map feature.

The issue is not the data model or animation as such. It is that the current
renderer animates route geometry while discarding the labels, people, spatial
layout, and progressive context that would make the movement meaningful.

---

## 13. Recommended replacement

### Map-first animated journey spotlight

The current tile should not merely be restyled. It should be rebuilt around the
map as the storytelling surface. The first frame must already explain the
journey; animation should then add life and sequence rather than unlock basic
meaning.

```text
JOURNEY                         Move 1 of 8  [Pause]
Noah’s Recolonization

┌─────────────────────────────────────────────────┐
│ City of Nephi                                   │
│   [Alma avatar +2] ─ ─ ─ ─▶ Place of Mormon    │
│           faint full-route context              │
│                         [3 future places]        │
│                                      Shilom     │
└─────────────────────────────────────────────────┘

City of Nephi → Place of Mormon · Mosiah 17–18
Alma escapes Noah’s servants and gathers believers at Mormon.

[ Explore this journey → ]
```

The scenic thumbnail should be removed from the default composition. It is a
second visual vocabulary competing with the map. If place art is retained, it
should appear only in an expanded detail or arrival state and must not push the
map or controls down the card.

### The first frame is an overview, not an empty starting point

Before playback begins, show:

- a curated title;
- origin and final-destination labels;
- the active origin/destination pair;
- a subtle silhouette of the full route, including discontinuities;
- explicit `8 moves · 7 places` counts;
- the first representative traveler party;
- a story-specific CTA.

This makes the tile useful to a user who scrolls past in two seconds, pauses
motion, uses reduced-motion settings, or never notices the playback control.

### Semantic progressive reveal

Progressive reveal should control *meaning*, not merely draw a line while every
numbered stop is already dumped onto the map.

1. **Establish:** retain origin/final labels, show a faint route silhouette, and
   cluster low-priority future places.
2. **Depart:** identify the current move and place a representative traveler
   party at the origin.
3. **Travel:** animate the active route and move the party along the same
   interpolation value.
4. **Arrive:** retain the destination label and visited route, update the short
   narrative, and promote the next relevant place or cluster.
5. **Complete:** show the fully labeled route and summary. Hold the completed
   state; do not immediately snap back to an unexplained first frame.

Future information is not simply hidden or shown. It is summarized until it
becomes relevant, then promoted without erasing the context already learned.

### Label-retention policy

Place names are core content and should never be discarded at the geometry
boundary. Each stop needs its stable identifier, display name, coordinates,
story order, visited/current/future state, and label priority.

Use explicit tiers:

| Priority | Content | Rule |
|---|---|---|
| 0 | Active origin and destination | Always visible; never clustered |
| 1 | Story origin and final destination | Retained throughout playback |
| 2 | Visited places | Retained when space permits; collapse only below higher tiers |
| 3 | Future places | Cluster or reveal progressively until relevant |

Numbers may supplement names, but must not be the primary identification
system. If a label is displaced to avoid an overlap, preserve its geographic
meaning with a leader line or clearly associated marker.

### Collision detection and clustering

Exact-slug deduplication is useful data normalization; it is not collision
detection. Distinct places can occupy the same or adjacent screen pixels after
the story is fitted into a 260px-tall viewport.

The replacement needs a screen-space layout pass after `fit()` and whenever
resolution or card width changes:

- put routes, stop/label symbols, and traveler overlays in separate layers;
- enable OpenLayers decluttering for text and icon styles;
- calculate label and avatar bounding boxes in rendered pixels, not geographic
  distance;
- resolve collisions by priority, displacement, or clustering—not by letting
  features obscure one another;
- cluster non-active future stops inside an approximately 28–36px screen-space
  radius, subject to visual testing;
- display a meaningful cluster count such as `3 places`, not an unexplained
  number;
- exempt active origin/destination markers from clustering;
- decluster, offset, or spiderfy co-located active places while preserving the
  true route endpoints;
- recompute on responsive resize and zoom/recenter;
- keep cluster behavior deterministic so labels do not jitter between frames.

OpenLayers' `declutter` and cluster source can supply part of this behavior, but
the product still needs its own semantic priority rules. A generic collision
algorithm cannot know that the current destination matters more than an
unvisited intermediate stop.

### Representative people should move on the map

`move.people` is already available. It should become a visual actor rather than
a detached row below the map.

- select at most two representative people or groups for the active move;
- render their existing avatars as one compact traveler party, with `+N` for
  additional participants;
- interpolate that party along the active leg using the same progress value as
  the route animation;
- keep avatar size stable in screen space;
- choose an offset side based on segment direction and collision results so the
  party does not cover the destination label;
- move the party to the arrival marker before advancing the narrative;
- expose the participant names in the move's visible text and accessible name;
- preload only the next beat's selected avatars, not every participant asset.

Animating every named person would recreate the clutter problem. The goal is a
legible representative party whose motion answers “who is going where?”

### Playback and control model

- keep animation, but cap the complete journey at roughly 20–24 seconds;
- group or shorten low-value beats rather than spending 5.5 seconds on every
  database move;
- replace the nine tiny dots with `Move 1 of 8` plus previous/next controls or a
  labeled scrubber;
- keep a visible play/pause control with a 44×44px target;
- pause on direct manipulation, keyboard focus within the player, document
  invisibility, and loss of viewport visibility;
- allow deliberate restart after completion rather than forcing an immediate
  loop;
- if map pan/zoom remains enabled, pause playback during manipulation and show a
  clear “Recenter story” action;
- for `prefers-reduced-motion`, show the completed labeled route and traveler
  summary without automatic updates;
- use a static pre-rendered version only as the load-error and reduced-capability
  fallback.

### Content and handoff

- replace database-like titles such as “Recolonization Noah” with edited Home
  titles such as “Noah’s Recolonization”;
- keep the current beat caption to two or three lines;
- distinguish `moveCount` from `stopCount` in plain language;
- retain scripture context without making it the only meaningful click;
- make the primary CTA open `/map/internal/story/${data.slug}`;
- preserve the same selected story and current or completed context after the
  handoff when technically feasible.

---

## 14. Options considered

### A. Keep the current animation and restyle it

**Reject.** Styling cannot repair missing place names, absent collision logic,
premature marker disclosure, detached participants, incompatible progress
units, or the generic deep link.

### B. Replace it with a static route preview

**Keep as a fallback, not the target experience.** A static overview would be
clearer and cheaper than the current tile, but it would leave the strongest
story data—people moving between named places—unused. It is appropriate for
reduced motion, loading failure, and an emergency MVP.

### C. Put all animation only in `/map`

**Reasonable but incomplete.** The full map should contain the richest
walkthrough, but Home can still support disciplined, glanceable motion. The
failure is not animation itself; it is animation without persistent context or
spatial layout management.

### D. Remove the concept permanently

**Reject for now.** Scripture, people, places, and movement are a distinctive
product proposition. The current execution should be contained while that idea
is rebuilt.

### E. Map-first animated preview with exact-story handoff

**Recommend.** It uses the existing data's narrative potential while imposing
the label priorities, clustering, collision detection, progressive reveal, and
bounded playback required by the Home context.

---

## 15. Prioritized remediation

### P0 — Contain the current bad experience

1. Temporarily remove `mapstory` from `FIXED_TAIL` while the replacement is
   developed.
2. Leave the registry and backend sampler intact.
3. Do not substitute the older empty `MapTile` reserve.

If temporary removal is not acceptable, the minimum emergency patch is:

1. link the title and CTA to `/map/internal/story/${data.slug}`;
2. change CTA text to “Explore this journey”;
3. expose display names for active map stops;
4. default playback to paused and show a complete route silhouette;
5. replace ambiguous dots with a visible `Move 1 of N` label;
6. provide a 44×44px play/pause target;
7. clamp/reserve a deliberate card-body height;
8. exclude uncurated titles such as the live example.

That patch reduces harm but does not solve spatial collisions or unlock the
people data.

### P1 — Preserve semantic map data

1. Extend the stop model to retain display names, story order, and semantic
   state through rendering.
2. Extract a pure full-route geometry and playback model from the current move
   data.
3. separate route, stop/label, cluster, and traveler layers;
4. represent full-route, visited, active, and future states explicitly;
5. keep discontinuity metadata intact;
6. add a text equivalent for the active move and whole route.

### P1 — Implement layout intelligence

1. Add screen-space collision detection after fit and resize.
2. Apply deterministic priority-based label retention.
3. Cluster only non-active, lower-priority stops.
4. Add decluster/offset behavior for overlapping active places.
5. Validate the densest eligible stories at 320px, 375px, 400px, tablet, and
   desktop card widths.

### P1 — Make people part of the journey

1. Select representative participants from `move.people`.
2. Render a compact avatar party on the active route.
3. Synchronize avatar and line interpolation.
4. Resolve avatar collisions against priority labels.
5. Provide names and `+N` semantics without loading every asset.

### P1 — Replace the timer carousel with semantic playback

1. Establish the full story before the first animated beat.
2. Retain visited geography and important labels.
3. Reveal future places through meaningful clusters.
4. replace dots with labeled movement controls;
5. cap runtime and hold on a useful completed state;
6. provide reduced-motion and renderer-failure fallbacks;
7. use a compact caption instead of stacked, height-influencing slides.

### P1 — Curate the story inventory

Add an explicit backend or database-level eligibility mechanism, such as:

- `home_featured` flag;
- curated allowlist;
- separate editorial title and Home synopsis;
- optional story weight/order;
- exclusion for unresolved discontinuities or incomplete copy.

Coordinate completeness is a data-integrity check, not a front-door quality
standard.

### P2 — Join the preview to the full map

Carry the selected story—and, if useful, current move—into the exact `/map`
story view. The larger surface can add a move list, complete place panels,
selection, recentering, and richer controls without making the Home tile bear
all of that complexity.

### P2 — Add product instrumentation

Measure:

- journey-preview impression when visible;
- exact-story CTA click;
- successful full-map story load;
- first place/move interaction in the full map;
- return/back behavior;
- comparison against a Home holdout without the tile.

The meaningful funnel is:

```text
understood journey preview
→ opened that exact journey
→ interacted with a move or place
```

Raw map-tile impressions or generic `/map` clicks do not measure success.

---

## 16. Acceptance criteria

### Temporary containment is complete when

- the current animated tile no longer appears in the Home fixed tail;
- no old `MapTile` is promoted as a replacement;
- Home masonry remains readable with a naturally ragged bottom;
- Home tests pass;
- `/map` and story-specific routes remain unchanged.

### The redesigned preview is ready when

- a user can identify the journey and its significance without waiting;
- the initial frame shows the route silhouette, origin, final destination, and
  active place names;
- active origin/destination labels are never hidden or clustered;
- story origin and final-destination labels persist throughout playback;
- no label, marker, cluster, avatar, or control visibly overlaps another at the
  supported card widths;
- lower-priority nearby stops form deterministic, labeled clusters instead of
  becoming overlapping numbered circles;
- clusters progressively disclose their member places as those places become
  relevant;
- representative avatars identify who is moving and track the active leg from
  departure through arrival;
- excess participants use an intelligible `+N` treatment rather than flooding
  the map;
- visited geography remains visible and future geography is summarized without
  hiding the journey's overall shape;
- move and place counts are labeled as different units;
- playback state is expressed as `Move X of N`, not as unlabeled dots;
- a complete eight-move example finishes within the agreed 20–24 second budget
  and holds on its useful completed state;
- pause, previous/next or scrubbing, restart, and recenter behaviors are clear
  and keyboard operable;
- play/pause and other primary controls have at least 44×44px targets;
- reduced-motion mode has no automatic movement or content churn and displays a
  composed final-route state;
- the primary CTA opens `/map/internal/story/${data.slug}`;
- the story title and synopsis have passed editorial review;
- the map has a text equivalent that names the active participants, origin,
  destination, and move count;
- the card has a bounded, intentional height at one- and two-column layouts;
- light, dark, 320px, 375px, 400px, tablet, and desktop screenshots—including
  the densest eligible story—pass visual review;
- resize, theme change, playback advancement, and recenter do not produce label
  jitter or stale collision layouts;
- failed avatars, map tiles, or renderer loading produce a composed static
  fallback;
- only the current and next representative avatar assets are eagerly loaded;
- analytics can distinguish impression, exact-story open, and downstream map
  interaction.

---

## 17. Test gaps and required coverage

Current tests do a good job on:

- timer progression and looping;
- pause behavior;
- dot count and selection;
- scripture popup action;
- display names versus slugs;
- discontinuity flags;
- traveler fallbacks;
- image-window loading;
- path helper correctness.

They do not protect the user-facing failures documented here:

- no assertion that the CTA includes `data.slug`;
- no assertion that whole-story context is visible at initial render;
- no assertion that key place names survive path-model construction;
- no label-priority or key-label retention test;
- no screen-space collision test after fit or responsive resize;
- no cluster membership, count, stability, or active-stop exemption test;
- no progressive-reveal state test distinguishing visited, active, clustered
  future, and final states;
- no avatar-selection, `+N`, interpolation, arrival, or label-collision test;
- no target-size or focus-visible check for dots;
- no visual regression for hidden-slide whitespace;
- no test that marker numbering and progress controls communicate distinct
  units;
- no test for story-title quality;
- no check that map content has an accessible text equivalent;
- no reduced-motion test that prevents automatic movement and announcements;
- no interaction test for pause-on-pan and recenter;
- no responsive visual matrix using dense stories;
- no playback-duration or transfer-budget gate.

Replace dot-specific tests with semantic playback-control tests. Keep timing
coverage, but assert the bounded journey duration and useful completed state
rather than preserving the current 5.5-second-per-move loop.

---

## 18. Code evidence from the original implementation

This table records the source snapshot evaluated before remediation. Its line
references identify the pre-change implementation (and the removed side of the
working-tree diff), not the replacement's current line numbers.

| Finding | Current location |
|---|---|
| 1.5s draw + 4s dwell + 3.5s summary | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:11-13, 72-78` |
| Autoplay begins at 40% visibility | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:55-70` |
| Generic `/map` links despite `data.slug` | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:90-93, 154` |
| One move slide plus a final summary | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:108-138` |
| One dot per move plus summary | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:140-151` |
| Dot selection also pauses | `frontend/webapp/src/views/Home/tiles/MapStoryTile.js:82-86` |
| Places/people render without links | `frontend/webapp/src/views/Home/tiles/MapStoryCard.js:17-70` |
| Stage stacks all slides in one grid cell | `frontend/webapp/src/views/Home/Sampler.css:1744-1764` |
| Map has a fixed 260px height | `frontend/webapp/src/views/Home/Sampler.css:1707-1709` |
| Dots are only 7×7px | `frontend/webapp/src/views/Home/Sampler.css:1817-1835` |
| Exact slug deduplication creates distinct stops but is not collision detection | `frontend/webapp/src/views/Home/tiles/mapStoryPath.js:30-50` |
| Stop construction discards the available place display name | `frontend/webapp/src/views/Home/tiles/mapStoryPath.js:35-50` |
| Stop layer has no decluttering, clustering, or semantic priority policy | `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js:112-114, 164-183` |
| `move.people` is rendered below the map instead of as a map actor | `frontend/webapp/src/views/Home/tiles/MapStoryCard.js:51-67` |
| Backend eligibility is coordinate/move based | `backend/src/graphql/resolvers/homesampler.ts:432-451` |
| Backend returns the available story slug | `backend/src/graphql/resolvers/homesampler.ts:480-505` |
| Story-specific map routes exist | `frontend/webapp/src/models/Routes.js:252-262` |
| Tile is fixed once at first-batch tail | `frontend/webapp/src/views/Home/Sampler.js:58-60, 506-511` |
| Registry only requires two moves | `frontend/webapp/src/views/Home/tiles/registry.js:50` |
| Full route is fitted but future legs hidden | `frontend/webapp/src/views/Home/tiles/MapStoryTileInner.js:134-141, 168-183` |

---

## Final judgment

The user feedback is not simply resistance to maps or animation. The card asks
the user to decode an abstract, long-running presentation in a context built
for quick content discovery.

The live example makes the failure concrete:

- an awkward title;
- seven place markers;
- nine progress dots;
- one visible leg;
- a summary delayed about 44 seconds;
- unexplained blank space;
- inert people and places;
- a CTA that abandons the story.

That combination is ugly because it lacks composition, confusing because it
mixes incompatible models, and useless because it does not complete the
journey into the full map.

The deepest failure is wasted semantic potential. The system knows the names of
the places, the people participating, the sequence of moves, and the story's
exact destination. The tile reduces that rich model to numbered circles and a
line, then omits the layout intelligence required even for those circles to
remain legible.

**Remove the current tile from Home while rebuilding it. Preserve the story
data and the idea of motion. Bring it back as a map-first animated journey with
persistent place labels, representative traveler avatars, screen-space
collision handling, meaningful clustering, semantic progressive reveal, and an
exact-story handoff.**

**Follow-up:** that rebuild is now present in the working tree and has passed
the controlled local checks summarized at the top of this audit. Production
API compatibility, deployed visual verification, editorial curation, and
instrumentation remain open release/product gates.
