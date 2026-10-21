# Analysis › Bible cross-reference page — visual / usability / dynamics audit

**Date:** 2026-10-20 · **Page:** `/analysis/bible/bom/3-nephi/13~matthew?bch=6` (prod, desktop 1440 and phone 390)
**Source:** `frontend/webapp/src/views/Analysis/Bible/` (`Rail.jsx`, `ChapterStrip.jsx`, `crossref.css`), shell in `views/_Common/{Header,Sidebar}.js`, `assets/theme/scss/paper-dashboard/`.
**Method:** screenshots read at both widths, DOM measurements (contrast, targets, fixed elements), interaction probes (chapter click + Back, scroll, Tab). Measurements are prod, 2026-10-20.

## What is working (keep)
- **The content is the design.** Two parallel scripture columns, quoted phrases highlighted inside the verse, the "Concerning Almsgiving" pericope titles, a per-chapter heat strip. This is the most useful thing the site shows and nothing needs to compete with it.
- Scripture face (`Scripture` serif) on tinted-white cards reads well; highlight tint is restrained.
- Chapter click → `…/3-nephi/14~matthew`, Back returns to chapter 13 with the same URL (works; no scroll trap).
- No horizontal overflow at 390 or 1440; zero page errors.

## Where it reads as "generated" — the header and the sidebar (the brief)
The page content has a point of view; the **shell around it has none.** It is the Paper Dashboard admin template (Bootstrap, `sidebar-wrapper`, `heading-bar`) in a navy-and-grey skin.

**Header (`heading-bar`, fixed)**
1. A 60 px near-black bar holding only a logo + small-caps wordmark; the other ~85% of the bar is empty. On the analysis page it carries no page context at all (the title, the book pair and the breadcrumb all live below it, on the content).
2. On phone it becomes a *different* header: wordmark wraps to two lines, a grey "0.0% ● 0.0% ●" pill and an avatar. Two unlabeled progress circles with no explanation, on a page about cross-references.
3. The wordmark is Roboto Condensed small-caps, i.e. the site's body face, so the brand has no typographic identity of its own.

**Sidebar (`sidebar-wrapper`, fixed, 250 px)**
1. **Ten equal-weight rows** (Contents … About), 22 px Roboto Condensed, each with a Font-Awesome-style glyph in a *different visual language* (a grid for Read, a film reel for Theater, a flask for Analysis, a globe for Map). The glyph set is not designed for this site and the scale (22 px label, ~28 px icon) is louder than the content they navigate to.
2. **An empty grey bar under "Guest"** (`.progress`, 204×24, #ddd, no label, no value). For a guest it is a dead control that looks like a disabled text field. Directly under it sit a mute icon and a settings cog with no labels; then a letter-spaced "S e a r c h" input in a white box that is the brightest object in the sidebar.
3. **Active state is a notch arrow + dark slab** (the template's pointer), and the BETA tag is a 9–11 px white-on-slate pill. Inactive rows are #aaa on #323b4d = 4.8:1 (passes, but only just, and everything is that same grey).
4. Language switch is a grey rounded rectangle with a flag, floating at the bottom, unrelated to anything above it.
5. Three different greys, one navy, one green: the shell shares no colors with the page it frames (the page is warm white + parchment highlight + a forest green).

**Why it smells like slop:** every part is a default of the template (icon list, notch, avatar block, grey pill, centered logo bar), nothing in it is specific to *scripture study*, and it spends its loudest typography on navigation rather than on the reader's place in the text.

## Content area — visual
| # | Finding | Sev |
|---|---|---|
| V1 | **Breadcrumb "Overview › 3 Nephi › ch. 13" is #bbb-ish on #eee = 1.34:1** (measured). Only the final crumb is readable. | P1 |
| V2 | The page title uses **two outlined pill chips** ("3 Nephi 13", "Matthew 6") inside a sentence. Chips are for filters/tags; here they make a heading look like a form. | P2 |
| V3 | Column heads "3 Nephi ▲ / Matthew △" repeat the book name that every card's own title ("3 Nephi 13:1") already states, three lines below the page title. Same information four times. | P2 |
| V4 | Meta/label stack is tracked-out all-caps (SMALL PLATES, PLATES OF MORMON, MORONI, QUOTE) at 9.6–11.2 px; **pericope subtitles are 11.2 px at 2.46:1**, SMALL PLATES eyebrow 3.86:1. | P1 (subtitle) |
| V5 | "34 references · 34 quotes" — two numbers that are identical here; middle-dot meta string is a generated-text tell. | P3 |
| V6 | Identical white rounded cards with the same soft shadow in two columns, ~35 deep; the only per-card variation is the green QUOTE badge, which is on *every* card, so it distinguishes nothing. (If the type can be "quote / allusion / echo" it should show; if every row is a quote, drop it.) | P2 |
| V7 | Chapter strip cells are 26 px squares with 10.4 px numerals; the heat tint is the only legend and has no key. | P2 |

## Usability
| # | Finding | Sev |
|---|---|---|
| U1 | **Nothing stays in view.** Title, chapter strip and column heads all scroll away (measured at scrollY 1600: strip at -1155, header at -1528). The page is 4,600 px (desktop) / 8,600 px (phone); the reader never knows which chapter or which Gospel they are in, and moving to the next chapter means scrolling back to the top. | P1 |
| U2 | **Phone keeps two columns at 390 px** → each card ~148 px wide, verses wrap at 4–5 words per line, a single verse is ~700 px tall, and the pair no longer sits side by side after the first long verse (row heights diverge). The comparison the page exists for degrades into reading two narrow strips. | P1 |
| U3 | Phone drops the book rail down to a bare list (Mosiah … 3 Nephi); Words of Mormon/4 Nephi/Mormon and the small-plates/Moroni totals disappear. Not obviously intentional. | P2 |
| U4 | Chapter cells are 26×26 (phone included): below the 44 px touch target the Home work standardized on. | P1 (touch) |
| U5 | Bottom nav on phone highlights **"User"** while the reader is in Analysis; the page's section is invisible in the nav. | P2 |
| U6 | `▲/△` on the column heads are sort/swap controls with no label or hint (filled vs outline = ?). | P2 |
| U7 | Focus ring is 2 px **#cfcfcf** on a #eee page (≈1.3:1): keyboard users cannot see where they are. Same on the rail buttons. | P1 |
| U8 | "‹ Back" (desktop) is a text link above a faint breadcrumb above the title: two ways back, one hidden. | P3 |

## Dynamics
- **Good:** chapter change is a real navigation with Back working; no layout jump on load (page is static after first paint).
- **Missing:** no feedback for the chapter change beyond the page swap (no active-strip scroll-into-view, no loading state); no way to jump between verses or to the next/previous chapter without returning to the top; verse rows do not link back to Read; hover/focus states on cards are absent (cards look interactive but are not — or are, with no cue).
- The empty `.progress` bar and the "0.0% / 0.0%" pill are *live-looking* controls with no state change for guests.

## Direction (proposal, nothing built)
The shell should say "a careful study tool for a book", not "admin dashboard", and it should quiet down so the two columns lead.
1. **Header:** carry context. Left: the wordmark (own face, not body Roboto Condensed). Center/right: *where you are* — "3 Nephi 13 ⇄ Matthew 6" as the page title lives here and stays fixed; the breadcrumb becomes the second line; progress circles only when signed in and labeled.
2. **Sidebar:** shrink to an icon-and-label rail (icons drawn as one set, one stroke weight), labels at reading size not 22 px, no notch; Analysis sub-views live under the active row instead of a separate rail. Remove the grey `.progress` for guests, give mute/settings real labels, move language into Settings.
3. **Color:** pull the shell from the page's own palette (the parchment highlight, the forest green, an ink near-black) rather than slate navy + #aaa; one accent used for the *selected* thing only.
4. **Content:** sticky chapter strip (with the current chapter scrolled into view, larger targets, a key for the heat tint); on phone **stack** instead of two narrow columns (a toggle "side by side / stacked", stacked by default under 600 px); drop duplicated column heads; fix breadcrumb/subtitle contrast; ring at ≥3:1.
5. **Dynamics:** prev/next-chapter at both ends; keyboard `[ ]` for chapter; verse number links to Read at that verse; reduced-motion respected for any strip auto-scroll.

## Open questions for KC
1. Is the analysis shell a candidate for the **site-wide** header/sidebar refresh, or only this section? (The shell is shared by every view, so a sidebar change is a site change.)
2. Is the QUOTE badge ever anything other than QUOTE? If not, remove it.
3. Is the "Open in app" banner in your screenshot the site's, or the browser's?
