# Front door: who arrives at the site root, and what each of them should get

**Date:** 2026-10-23 · **Status:** analysis + recommendation, nothing built · **Author:** Claude for KC
**Question (KC):** Make Discover (`/home`) the first thing a *new* visitor meets at `/`; send returning/logged-in people to their own place (progress). Nobody should end up lost or on something ugly when they open a thing from Discover.

## 1. What the site does today (verified in code and prod logs)

| Fact | Where |
|---|---|
| `/` renders the **Read** view. With no `localStorage.chapterRef` it opens 1 Nephi 1; otherwise the last chapter read. So returning readers already resume. | `models/Routes.js:63`, `utils/scriptureUtils.js:159`, `views/Read/Read.js` |
| `/home` is Discover (Sampler); `/home/user` is the profile/progress page (guests see sign-in); `/home/community` only where messenger is on. | `views/Home/Home.js` |
| **On prod the "Home" entry is removed from the sidebar** and the logo link, and `/home` is `seo: remove` (not in sitemaps, crawlers 404). Matters and History are hidden the same way. This is the "turned off sidebar thing". | `config/features.yml`, `featureFlags.js:90`, `menuConfig.js` |
| Phone bottom nav still shows Groups · Home · Study · User · More. | `BottomNav.js` |
| Login state: `localStorage.token` or cookie `u`, validated by `tokenSignIn` on load. "Returning" has **no signal today** except `chapterRef`. | `Main.js:133` |
| Crawlers get SSR (Next) by user agent; browsers get the CRA app. | middleware, `nextjs_ssr_parity` |

**Prod traffic shape** (NPM telemetry, last ~17 h, real-browser document loads only, ~6.7k; no session id or referrer, so this is *page-load mix*, not unique visitors):

| Landing page type | Share |
|---|---|
| Deep chapter/story pages (`/jaredites/…`, `/promised-land/…`, etc.) | ~59% |
| Entity/feature pages (people, places, fax, art, map…) | ~23% |
| `/` (root) | ~17% |
| `/read…`, `/study…`, `/contents` | ~1% |
| `/home*` | ~1% (59 loads) |

Takeaway: **the root is not the main door.** Most people arrive on a specific page from search or a shared link. The root is about one in six loads, and Discover is effectively invisible today. Two consequences: (a) the front-door change touches a minority of arrivals, so it is low-risk to experiment with, and (b) the deep-link majority needs its own "what next?" path, and that path is currently nothing.

## 2. The people who arrive

| # | Profile | How we know them | Arrives at | What they want | What they get today |
|---|---|---|---|---|---|
| A | **Cold curious visitor** (word of mouth, social, a friend's link to `/`) | no token, no `chapterRef` | `/` | to see what this is and whether it is for them; poke around | 1 Nephi 1 verse text. A wall of scripture, no sense of the study layer. |
| B | **Search/deep-link reader** | no token | a chapter/entity page | the thing they searched; then maybe "what else is here" | the page; a sidebar of ten equal rows. No bridge into Discover. |
| C | **Returning anonymous reader** | `chapterRef` set, no token | `/` | to pick up where they stopped | resumes chapter (works) |
| D | **Signed-in learner** (progress, plan, notes) | token valid | `/` | continue the plan / today's reading, see progress | same as C; progress hides behind the avatar → `/home/user` |
| E | **Signed-in, lapsed** | token, nothing new for weeks | `/` | a gentle re-entry, not a dashboard of zeros | same as D |
| F | **Korean (and other-language) host visitor** | host language | `/` | all of the above in their language | Discover now Korean except content data |
| G | **Crawler / link-preview bot** | UA class | `/` | stable, indexable content | SSR reader content (correct) |
| H | **Study-group member** (messenger hosts only) | token + groups | `/` or invite | their group | outside this analysis |

## 3. Intended journeys

**A, cold visitor → Discover.** Land on a sampler that shows faces, places, art, a story map: *this site is a world to wander, not a text file.* They tap one thing. It opens in place (popup/drawer), they can maximise, and Back returns to exactly where they were. After two or three of these the natural next step is "read the thing this came from" (See in context → Read). Success = they reach Read or Explore a second entity; failure = they bounce from a dead end or lose their place.

**B, deep-link reader.** Unchanged landing. Add one quiet bridge on content pages: a "Discover" item in the nav and, at the end of an entity/chapter, "More to explore". They enter Discover on their own terms.

**C, returning anonymous.** Do not show the sampler first: they came back to read. `/` resumes the chapter (today's behaviour) with a small "Discover" item reachable in nav. Optional: a one-line "Continue: Alma 32" chip on Discover for them.

**D, signed-in learner.** Land on **their** page. Recommended: not a settings screen but a "Continue" surface: *resume reading, today's plan portion, streak/progress*, then a few Discover tiles beneath. This is a new composition of existing parts (ReadingPlan active state, ProgressBox, chapterRef), not a redirect to `/home/user` as it exists (which is profile + preferences + history).

**E, lapsed.** Same as D but lead with "Welcome back, you were in Alma 32" and no empty progress bars. Optional.

**F, other languages.** Same logic; every string behind labels (done for Discover and the reading-plan wizard).

**G, crawler.** Must keep seeing stable, indexable Reader content at `/`. See risks.

## 4. The decision rule at `/`

Evaluate synchronously from `localStorage` before first render (no flash, no redirect hop):

```
token or u-cookie present            -> Continue surface (D/E)       [signed in]
else chapterRef present or `bomSeen` -> Read, resumed (C)            [returning]
else                                  -> Discover (A)                 [first visit]
```

- Set `bomSeen=<date>` the first time Discover is shown or any page is read; "returning" then survives clearing nothing but cookies-only.
- It is a **client route decision, not a redirect**: render the chosen view at `/` (URL stays `/`), so Back leaves the site normally and there is no loop. If a redirect is preferred (`/home`), use `replace`.
- Private mode / storage blocked → treated as first visit; harmless.
- A visible "Discover / Read" switch must always exist, so the rule is a default, never a trap.

## 5. Where people get lost (the part that matters most)

Mapped from KC's first click and the code. Each is a rule the product must keep:

| # | Lost moment | Rule | State |
|---|---|---|---|
| L1 | Tile → full page → page's own "‹ Places" → out of Discover | An in-app arrival's back control is history Back | **fixed, on prod** |
| L2 | Tile → full page directly | Entities open a popup that can maximise | **fixed, on prod** |
| L3 | Nav shows nothing selected (Matters/History hidden; Home hidden on prod) | Under a popup, nav follows the page beneath; and **Discover must have a nav home** | popup case fixed; **Discover entry missing on prod** |
| L4 | History documents and art open full pages | popups, same pattern | open (back control exists) |
| L5 | A deep-linked page has no way into Discover | nav item + end-of-page bridge | open |
| L6 | Reading plan / sign-in from a tile leaves Discover | "Back to Discover" after sign-in; return URL | unverified |
| L7 | Phone: bottom nav "Home" highlights while inside Study/Read opened from a tile | follow the page, not the tab | partly (navPath) |

## 6. Sidebar and header (KC: "maybe we need to restore it")

Yes, restore **one** entry: **Discover** (top of the list, above Contents), un-hide `homeNav` for the nav item only, while `/home` SEO stays `remove` until the SEO decision below. It is the answer to L3, L5 and the "I lost my place" complaint: a stable, always-visible way back to the sampler. Matters and History can stay hidden from the nav (their pages are still reached from tiles); their pages should then show the Discover item as active when arrived from Discover. This is also the first concrete step of the shell redesign already approved in principle (docs/audits/2026-10-20-analysis-xref-page-audit.md).

## 7. Risks and open decisions (the ones that change what gets built)

1. **SEO / cloaking.** `/` for crawlers is SSR Reader content; for first-time humans it would become Discover. Same URL, different primary content by audience. Options: (a) accept (UA gating already differentiates), (b) SSR `/` also shows a Discover-style hero + the chapter text, (c) put Discover at `/discover` and make `/` a tiny chooser. Needs KC's call; recommendation is (a) now, revisit with search-console data after 4 weeks.
2. **`/home` is `seo: remove`.** If Discover becomes the front door the flag can stay as-is (the URL users see is `/`), but a shareable Discover link then has no indexable page. Fine for now.
3. **Is "Continue" for signed-in users a new screen or `/home/user`?** Recommendation: new composition ("Continue" + plan + a few tiles), `/home/user` stays as profile/preferences.
4. **Logged-in share is unknown.** The telemetry has no auth signal and the sample is page loads. Before building D/E at scale, add a privacy-safe counter (signed-in vs not on `/`) so we size what we are optimising.
5. **Mobile first.** Browser UAs here are ~7% phone, which looks wrong against the product's own brief; check the classification before trusting the device mix.

## 8. Recommended order

1. **Restore a "Discover" nav entry on prod** (sidebar + logo link), active under popups. Small, answers L3/L5. *(needs approval; a deploy)*
2. **First-visit rule at `/`** behind a flag (`frontDoor`), A only: first visit → Discover; everyone else unchanged. Measure bounce to Read / second entity open.
3. **L4**: history docs and art as popups (same delegated handler).
4. **L6**: sign-in/plan round trip returns to Discover.
5. **D/E "Continue" surface** after the counter in risk 4 says it is worth it.
6. Then the shell redesign (header with context, one icon set) with Discover in the rail.

## 9. What I need from KC

- Yes/no on the first-visit rule being a **render at `/`** (not a redirect).
- SEO option 7.1 (a), (b) or (c).
- Whether "Discover" in the nav may go live on prod now (step 1).
