# Matters Popup UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the right-hand column of the Matter profile popup — a real image placeholder, and a relationships list redesigned to match the People/Places card pattern.

**Architecture:** `XrelSection` is shared by the matter, person, and place popups. Rather than branching it for Matters, we bring it up to the card pattern People already uses for its *other* relationship list, which makes all three popups internally consistent. A new shared `EntityThumb` component supplies gradient-and-initials fallbacks wherever an entity image can 404.

**Tech Stack:** React 17 (CRA), `@testing-library/react` + Jest via `react-scripts test`, plain CSS, `react-tooltip` (already a dependency), MySQL `bom_label` for i18n.

---

## Context you need before starting

**Run all commands from `frontend/webapp/`** unless stated otherwise.

- Test: `CI=true npx react-scripts test --watchAll=false --testPathPattern="<pattern>"`
  Bare `npx jest` does **not** work — it bypasses CRA's babel config and dies on JSX.
- Lint: `npx eslint src/views/_Common src/views/Matters`
- The repo root is `/Users/kckern/Documents/GitHub/BookofMormonOnline`, branch `dev`.

### The shared-component constraint

`XrelSection` is rendered in three places (`PopUp.js:293` person, `:453` place, `:583` matter) and has **7 existing tests** in `src/views/_Common/__tests__/XrelSection.test.js`. Those tests encode current behaviour and several will need updating — that is expected and fine, but **every change to them must be deliberate**, and People/Places must be visually verified, not assumed.

A prior task in this project pushed Matters-only rendering into the shared `FilterPanel` and had to be fully reverted. Do not repeat that. If something is Matters-specific, it goes in a Matters file.

### What is actually wrong (diagnosed, with causes)

1. **The image placeholder does not exist.** `PopUp.js:570-577` sets `opacity: 0.5` on a broken `<img>` and stops, so the browser draws its native broken-image chip. `.ppbody .ppimg img` (`PopUp.css:466`) sets only `border` and `border-radius` — **no width or height** — so a failed load has no box. 314 of 487 matters have no rendered art, so Matters is where this shows.
2. **A nested scrollbar.** `.xrels { max-height: 18em; overflow-y: auto }` (`PopUp.css:671`) inside `.refbox` inside the scrolling popup body. This is the **only content-level internal scroll in the entire stylesheet** — an anomaly, not a convention. It clips rows mid-item.
3. **Four lines per relationship.** `XrelSection.js:42-43` renders `dst_name` **and** `dst_title` inside one `<a>`, so a 46-character parenthetical wraps to two lines *and* is styled as a link. `xrel-note` adds a third line.
4. **A form layout, not prose.** `.rel-verb` has `min-width: 7em` and `.xrel-note` has `margin-left: 7.5em`, spending a quarter of a 40%-width column on a grey pill.
5. **Raw slugs.** `dst_type: 'group'` has no table to resolve against, so the loader falls through with `dst_name = dst_slug` — "lamanites", lowercase, grey, unclickable. Looks broken.
6. **Machine verbs.** `rel` is the raw column with `text-transform: capitalize`, yielding "Wielded-By". No label keys exist for any of the 75 verbs.
7. **No grouping.** Sorted by `verse_id`, so relation types interleave. 448 matters have relations (avg 5.6, max 23: `ornaments` and `tents`).

### The benchmark: what People/Places already do right

From `Relationships` (`PopUp.js:599`) and `.related_*` (`PopUp.css:577-658`):

| | People pattern | Matters today |
|---|---|---|
| Layout | 2-up wrapping card grid (`width: calc(50% - 1ex)`) | 1-per-row list |
| Thumbnail | 3rem avatar per relation | none |
| Inner scroll | none | `max-height: 18em` |
| Phrasing | name bolded *inside* the sentence | pill + separate link |
| Title | **tooltip** (`data-tip`) | inline, 2 lines |
| Click target | whole card, with `:hover` | the `<a>` only |
| Responsive | 50% → 80% → 100% | none |

**The decisive move is the tooltip.** People's titles are just as long; they simply don't spend layout on them.

**Note the existing inconsistency:** the Person popup renders `<Relationships>` (cards) directly above `<XrelSection>` (list) under a single "Relationships" heading — two visual languages in one panel. Converting `XrelSection` to cards **fixes** People and Places; it does not endanger them.

---

## Task 1: Baseline

**Step 1: Confirm the suite is green before touching anything**

```bash
cd frontend/webapp
CI=true npx react-scripts test --watchAll=false --testPathPattern="XrelSection"
```
Expected: `Tests: 7 passed`. If not, stop and report — do not build on a red baseline.

**Step 2: Record what People and Places look like now**

Open a person popup and a place popup in the running app and screenshot the relationships area. You will compare against these at the end. There is no visual regression harness; this is the only guard.

---

## Task 2: `EntityThumb` — the shared image fallback

`Matters.js` already has a good fallback (slug-seeded gradient + initials) used on the index tiles. Extract it so the popup and the relationship cards can use it too.

**Files:**
- Create: `src/views/_Common/EntityThumb.jsx`
- Create: `src/views/_Common/EntityThumb.css`
- Test: `src/views/_Common/__tests__/EntityThumb.test.js`

**Step 1: Write the failing test**

```jsx
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import EntityThumb from "../EntityThumb";

jest.mock("src/models/BoMOnlineAPI", () => ({ assetUrl: "https://cdn.test" }));

describe("EntityThumb", () => {
  test("renders an img pointing at the asset path for its type", () => {
    render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/matters/swords");
  });

  test("on error it swaps to a gradient placeholder carrying the initials", () => {
    render(<EntityThumb type="matters" slug="swords" name="Sword of Laban" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("SO")).toBeInTheDocument();
  });

  test("the placeholder gradient is stable for a given slug", () => {
    const { container: a } = render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    fireEvent.error(a.querySelector("img"));
    const { container: b } = render(<EntityThumb type="matters" slug="swords" name="Swords" />);
    fireEvent.error(b.querySelector("img"));
    expect(a.querySelector(".entityThumb").style.background)
      .toBe(b.querySelector(".entityThumb").style.background);
  });

  test("a one-word name yields two letters, not one", () => {
    render(<EntityThumb type="people" slug="nephi" name="Nephi" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("NE")).toBeInTheDocument();
  });
});
```

**Step 2: Run it and watch it fail**

```bash
CI=true npx react-scripts test --watchAll=false --testPathPattern="EntityThumb"
```
Expected: FAIL — `Cannot find module '../EntityThumb'`.

**Step 3: Implement**

Move `hashSlug`, `slugGradient`, and `matterInitials` out of `src/views/Matters/Matters.js` (lines ~20-54) into `EntityThumb.jsx` — do not copy them, **move** them, and have `Matters.js` import from here. Two implementations of the same fallback is how this defect arose.

```jsx
/** @format */
import React, { useState } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import "./EntityThumb.css";

/** djb2-ish hash → stable seed for slug-based gradients. */
const hashSlug = (slug) => {
  let h = 0;
  const s = slug || "";
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
};

export const slugGradient = (slug) => {
  const h = hashSlug(slug);
  const hue1 = h % 360;
  const hue2 = (hue1 + 30 + ((h >> 8) % 50)) % 360;
  const sat = 45 + ((h >> 16) % 25);
  return `linear-gradient(135deg, hsl(${hue1}, ${sat}%, 48%) 0%, hsl(${hue2}, ${sat}%, 26%) 100%)`;
};

export const entityInitials = (name) => {
  const cleaned = (name || "").replace(/[^\p{L}\s]/gu, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
};

/**
 * Entity image with a designed fallback.
 *
 * Most Matters have no rendered artwork yet (314 of 487 are placeholders), so a
 * 404 here is the common case, not the exception. On error we swap to a
 * slug-seeded gradient carrying the entity's initials rather than leaving the
 * browser to draw its broken-image chip.
 *
 * `size` is any CSS length and drives a square box, so a failed load still
 * occupies its space — the previous markup set no dimensions at all.
 */
export default function EntityThumb({ type, slug, name, size, className, rounded }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const cls = "entityThumb" + (rounded ? " rounded" : "") + (className ? " " + className : "");

  if (failed || !slug) {
    return (
      <div className={cls + " fallback"} style={{ ...style, background: slugGradient(slug) }} title={name}>
        <span aria-hidden="true">{entityInitials(name)}</span>
      </div>
    );
  }
  return (
    <div className={cls} style={style}>
      <img alt={name} src={`${assetUrl}/${type}/${slug}`} onError={() => setFailed(true)} />
    </div>
  );
}
```

```css
/* EntityThumb.css */
.entityThumb { overflow: hidden; flex-shrink: 0; }
.entityThumb.rounded { border-radius: 1rem; }
.entityThumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.entityThumb.fallback {
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; letter-spacing: .05em;
  font-size: calc(var(--thumb-font, 1rem));
}
```

**Step 4: Run the test — expect PASS. Then confirm Matters.js still works:**

```bash
CI=true npx react-scripts test --watchAll=false --testPathPattern="EntityThumb"
npx eslint src/views/Matters/Matters.js src/views/_Common/EntityThumb.jsx
```

**Step 5: Commit**

```bash
git add src/views/_Common/EntityThumb.jsx src/views/_Common/EntityThumb.css \
        src/views/_Common/__tests__/EntityThumb.test.js src/views/Matters/Matters.js
git commit -m "feat: shared EntityThumb with gradient-and-initials fallback

Extracted from Matters.js, which already had this fallback for index
tiles while the popup left the browser to draw a broken-image chip.
Two implementations of one fallback is how that gap appeared."
```

---

## Task 3: Human-readable relation verbs

75 distinct verbs exist across `bom_xrels`; 74 are used by matters. They currently render as raw hyphenated slugs with `text-transform: capitalize` ("Wielded-By").

**Files:**
- Create: `src/views/_Common/xrelVerbs.js`
- Test: `src/views/_Common/__tests__/xrelVerbs.test.js`

**Step 1: Write the failing test**

```js
import { verbLabel } from "../xrelVerbs";
jest.mock("src/models/Utils", () => ({ label: (k) => k }));

describe("verbLabel", () => {
  test("de-hyphenates when the dictionary has no entry", () => {
    expect(verbLabel("wielded-by")).toBe("wielded by");
    expect(verbLabel("instance-of")).toBe("instance of");
  });
  test("handles a bare verb", () => { expect(verbLabel("includes")).toBe("includes"); });
  test("is safe on null", () => { expect(verbLabel(null)).toBe(""); });
});
```

**Step 2: Run it — expect FAIL (module not found).**

**Step 3: Implement**

```js
/** @format */
import { label } from "src/models/Utils";

/**
 * Human-readable relation verb.
 *
 * Utils.label() returns the KEY itself when the dictionary lacks an entry (and
 * " " before it loads), so `label(k) || fallback` never falls back. Treat a
 * key-echo as a miss and de-hyphenate instead.
 */
export function verbLabel(rel) {
  if (!rel) return "";
  const key = "xrel_" + String(rel).replace(/-/g, "_");
  const v = label(key);
  if (v && v !== key && String(v).trim()) return v;
  return String(rel).replace(/-/g, " ");
}
```

**Step 4: Run — expect PASS.**

**Step 5: Generate the label rows** (from the workspace repo, which owns SQL artifacts)

```bash
cd /Users/kckern/Documents/GitHub/BoMOnlineWorkspace
```
Write a small node script that reads `SELECT DISTINCT rel FROM bom_xrels`, and for each emits an additive INSERT into `bom_label` with `type='xrel_verb'`, `label_id='xrel_<verb_with_underscores>'`, `label_text=<verb with spaces, sentence case>`. Deterministic 13-hex guids (md5 of the key, retried on collision), and **skip any label_id already present**. Write to `sql/xrel_verbs.sql`.

**Do not execute it.** Per the standing repo rule, KC runs SQL. Note in the file header that the UI already renders correctly without these rows — they only matter for translation.

**Step 6: Commit** both the module and the SQL.

---

## Task 4: Redesign `XrelSection` as cards

The core change. Read the shared-component constraint above before starting.

**Files:**
- Modify: `src/views/_Common/XrelSection.js`
- Modify: `src/views/_Common/__tests__/XrelSection.test.js`
- Create: `src/views/_Common/XrelSection.css`
- Modify: `src/views/_Common/PopUp.css` (remove the old `.xrels` block, lines ~667-710)

**Step 1: Update the tests to the new contract**

Keep all 7 existing behaviours that still apply (empty states, click routing by `dst_type`, group non-clickability, note rendering). Change what the redesign deliberately alters, and add:

```jsx
test("the title is a tooltip, not inline text", () => {
  render(<XrelSection xrels={[srcRow]} />);
  const card = document.querySelector(".xrel");
  expect(card).toHaveAttribute("data-tip", "Son of Lehi");
  expect(card.textContent).not.toContain("Son of Lehi");
});

test("the whole card is clickable, not just the name", () => {
  render(<XrelSection xrels={[srcRow]} />);
  fireEvent.click(document.querySelector(".xrel"));
  expect(mockSetPopUp).toHaveBeenCalledWith({ type: "people", ids: ["nephi"], underSlug: "people" });
});

test("group rows render as a tag rather than a dead link", () => {
  render(<XrelSection xrels={[{ ...srcRow, dst_type: "group", dst_name: "lamanites" }]} />);
  expect(document.querySelector(".xrel a")).toBeNull();
  expect(document.querySelector(".xrel-tag")).toBeInTheDocument();
});

test("rows are grouped by relation verb with a count", () => {
  render(<XrelSection xrels={[srcRow, { ...srcRow, dst_slug: "lehi", dst_name: "Lehi" }, dstRow]} />);
  const heads = [...document.querySelectorAll(".xrel-group-head")].map((h) => h.textContent);
  expect(heads.some((h) => h.includes("held by") && h.includes("2"))).toBe(true);
});

test("verbs render human-readable, not hyphenated", () => {
  render(<XrelSection xrels={[srcRow]} />);
  expect(document.body.textContent).toContain("held by");
  expect(document.body.textContent).not.toContain("held-by");
});
```

**Step 2: Run — watch the new tests fail** for the right reasons (title still inline, no `.xrel-group-head`, etc.).

**Step 3: Implement**

Requirements, in priority order:

- **Group rows by `rel`**, preserving first-appearance order of each verb (the incoming array is already sorted by `verse_id`, so first-appearance keeps narrative order). Render a `.xrel-group-head` per verb: `verbLabel(rel)` plus a count when > 1.
- **Card grid**: `.xrels` becomes `display:flex; flex-wrap:wrap`, cards at `calc(50% - 1ex)`, mirroring `.related_row`.
- **One line of text per card**: the name only. `dst_title` moves to `data-tip` on the card, rendered by the `ReactTooltip` already imported in `PopUp.js` — reuse id `relToolTip` so no second tooltip instance is created.
- **Thumbnail**: `<EntityThumb type={...} slug={dst_slug} name={dst_name} size="2.5rem" />` for `people`/`place`/`matter`. Map `dst_type` → asset path: `people`→`people`, `place`→`places`, `matter`→`matters`. **No thumbnail for `group`** — there is no asset.
- **Whole card clickable** for the three linkable types, with a `:hover` background matching `.related_row:hover` (#EEE). Groups get `.xrel-tag`, no anchor, no pointer.
- **The note** stays but as a small muted line inside the card, with **no fixed left indent** — delete the `margin-left: 7.5em`.
- **Keep the `direction` distinction.** `direction: "dst"` still reads name-then-verb; with grouping, that means the group head sits after the names for reverse rows, or simply render reverse groups with the head phrased accordingly. Preserve the existing tests' intent.

**Step 4: Delete the old CSS.** Remove `.xrels`, `.xrels .xrel`, `.rel-verb`, `.xrel-note` and friends from `PopUp.css` (~667-710) — including `max-height: 18em; overflow-y: auto`. Put the new rules in `XrelSection.css` and import it from the component. Add the responsive breakpoints People uses (50% → 80% at 1200px → 100% at 800px).

**Step 5: Run the full suite**

```bash
CI=true npx react-scripts test --watchAll=false --testPathPattern="XrelSection"
npx eslint src/views/_Common
```

**Step 6: Verify People and Places by eye.** Open both popups. They should now show one consistent card language instead of `Relationships` cards stacked above an `XrelSection` list. **If either looks worse than your Task 1 screenshots, stop and report rather than proceeding.**

**Step 7: Commit**

---

## Task 5: Fix the popup hero image and the column ratio

**Files:**
- Modify: `src/views/_Common/PopUp.js:568-580` (matter), `:286` (person), `:444` (place)
- Modify: `src/views/_Common/PopUp.css:432-472`

**Step 1:** Replace the hand-rolled `<img onError>` in the matter popup with `<EntityThumb type="matters" slug={obj.slug} name={obj.name} rounded />`. Do the same for person (`type="people"`) and place (`type="places"`) so all three share one behaviour.

**Step 2:** Give `.ppbody .ppimg img` real dimensions — `width: 100%; height: auto; display: block` — so a failed load still occupies its box. This is the root cause of the shrink-wrapped broken chip.

**Step 3:** Widen `.refbox` from `40%` toward `45%`, or reduce what it carries. The right column holds image + relationships + references while the prose gets 60% for a few paragraphs. Use judgement; the goal is that the relationship cards get enough width to sit 2-up without wrapping mid-name.

**Step 4:** Verify all three popups. **Commit.**

---

## Task 6: Full verification

**Step 1: Whole frontend suite**

```bash
cd frontend/webapp
CI=true npx react-scripts test --watchAll=false 2>&1 | tail -20
```
Expected: no new failures against the Task 1 baseline. Record any pre-existing failures separately rather than "fixing" unrelated tests.

**Step 2: Lint**

```bash
npx eslint src/views/_Common src/views/Matters
```
Expected: 0 errors. One pre-existing `react-hooks/exhaustive-deps` warning in `Matters.js` is acceptable.

**Step 3: Manual check across the three popups**

- A matter with **no** artwork (e.g. `swords`) → gradient placeholder with initials, no broken chip
- A matter with artwork → image renders as before
- A matter with **23** relations (`ornaments` or `tents`) → grouped, 2-up, **no inner scrollbar**
- A matter with a group target (`swords` has 4) → renders as a tag, not a dead grey link
- A **person** and a **place** popup → consistent card language, nothing regressed

**Step 4: Commit and report** what changed, what you verified by eye, and anything you could not verify.

---

## Explicitly out of scope

- Generating the 314 missing raster images. The placeholder is the fix here.
- Translating the 75 verb labels into the other 11 languages. `sql/xrel_verbs.sql` seeds English only; `label_translations` is a separate pass.
- The `Relationships` component (People's person-to-person relations). It is already the pattern being copied; leave it alone.
- Resolving `dst_type: 'group'` to real records. There is no group table; the tag treatment is the accepted answer.

## Risks

- **`XrelSection` is shared.** Every change lands on three popups at once. The tests cover behaviour, not appearance — People and Places must be checked by eye.
- **Grouping changes reading order.** Rows currently sort by `verse_id`; grouping by verb necessarily breaks that within a group. Preserving first-appearance order of verbs keeps the narrative sequence at the group level, which is the best available compromise. Flag it if it reads badly.
- **`ReactTooltip` id reuse.** `PopUp.js` already mounts `relToolTip` inside `Relationships`. On a *matter* popup that component never renders, so the tooltip instance will not exist — mount one in `XrelSection` itself, or the tooltips will silently do nothing on matter popups. **Verify tooltips actually appear on a matter popup, not just a person popup.**
