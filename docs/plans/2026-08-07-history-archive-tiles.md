# History Archive Home Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Home-sampler tiles for the translation and joseph-smith history archives (reception + witnesses already have tiles), by extracting a shared `ArchiveDocTile` from `HistoryTile` and adding two homesampler samplers.

**Architecture:** Two new `homesampler` samplers (`translation`, `josephSmith`) mirror the reception `sampleHistory` (joseph drops the thumbnail requirement). A shared `ArchiveDocTile` renders the quote-hero doc card, gating on `data` (not `data.id`) with the image as an explicit prop; `HistoryTile`/`TranslationTile`/`JosephSmithTile` are thin wrappers differing by image + deep-link. Two reserve-pool registry entries surface the new tiles. Spec: `docs/specs/2026-08-07-history-archive-tiles-design.md`.

**Tech Stack:** Backend TypeScript (Kysely, GraphQL SDL). React 17 + Jest/`@testing-library/react` (`react-scripts test`, `resetMocks:true`).

**Working directory:** paths relative to repo root `/home/bom/BookofMormonOnline`. Frontend commands from `frontend/webapp/`:
```bash
cd frontend/webapp
```
Frontend test runner: `CI=true npx react-scripts test <path> --watchAll=false`. Backend GraphQL: `http://localhost:5006/`; reload the backend with `systemctl --user restart bom-greenfield`.

**Branch:** `feat/history-archive-tiles` (already checked out).

**Commit trailer (every commit):**
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/src/graphql/resolvers/homesampler.ts` | `sampleArchiveDoc` helper + `translation`/`josephSmith` samplers | 1 |
| `backend/schema/HomeSampler.graphql` | `translation` + `josephSmith` fields | 1 |
| `frontend/.../models/GraphQLQueries.js` | homesampler `translation`/`josephSmith` selections | 2 |
| `frontend/.../Home/tiles/ArchiveDocTile.jsx` | **new** shared doc-tile core | 3 |
| `frontend/.../Home/tiles/HistoryTile.js` | thin wrapper (reception) | 3 |
| `frontend/.../Home/tiles/__tests__/ArchiveDocTile.test.js` | **new** tests | 3 |
| `frontend/.../Home/tiles/TranslationTile.js` | **new** wrapper (no image) | 4 |
| `frontend/.../Home/tiles/JosephSmithTile.js` | **new** wrapper (portrait) | 4 |
| `frontend/.../Home/tiles/registry.js` | reserve-pool entries | 4 |

**Dependency order:** 1 → 2 (data) then 3 → 4 (tiles). Task 3 must precede 4 (wrappers import `ArchiveDocTile`).

---

## Task 1: Backend — translation + joseph-smith samplers

**Files:**
- Modify: `backend/src/graphql/resolvers/homesampler.ts` (the `sampleHistory` fn ~641-666 and the `samplers` map)
- Modify: `backend/schema/HomeSampler.graphql`

- [ ] **Step 1: Extract a parameterized sampler + add the two new archives**

In `backend/src/graphql/resolvers/homesampler.ts`, replace the existing `sampleHistory` function (the whole block from its comment through its closing `};`, ~lines 636-666) with a shared helper plus three archive bindings:
```typescript
// One featured historical document from an archive: a teaser + an editorially
// prepared money quote (same bar as the witness tile). requireThumb gates on a
// renderable thumbnail (reception/translation have them; joseph-smith does not).
// The reception/translation docs deep-link to /history/:slug; the quote fields
// are parsed from metadata onto the row so the HistoricalDocument resolvers see
// them.
const sampleArchiveDoc =
  (archive: string, requireThumb: boolean) =>
  async (ctx: AppContext, seed: number) => {
    let qb = ctx.db
      .selectFrom('bom_xtras_history')
      .selectAll()
      .where('archive', '=', archive)
      .where(sql<boolean>`teaser IS NOT NULL AND CHAR_LENGTH(teaser) > 30`)
      .where(sql<boolean>`JSON_EXTRACT(metadata,'$.money_quote') IS NOT NULL`);
    if (requireThumb) qb = qb.where('aspect', 'is not', null);
    const rows = await qb.orderBy(seededOrder('id', seed)).limit(1).execute();
    const row = rows[0];
    if (!row) return null;
    let money_quote: string | null = null;
    let mini_quote: string | null = null;
    let quote_speaker: string | null = null;
    let quote_is_witness_voice: boolean | null = null;
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata as Record<string, unknown> | null);
      money_quote = (meta?.money_quote as string) ?? null;
      mini_quote = (meta?.miniquote as string) ?? null;
      quote_speaker = (meta?.quote_speaker as string) ?? null;
      quote_is_witness_voice = (meta?.quote_is_witness_voice as boolean) ?? null;
    } catch { /* metadata may be absent/invalid */ }
    return { ...row, money_quote, mini_quote, quote_speaker, quote_is_witness_voice };
  };

// Pinned to reception: the /history/:slug view only loads that archive.
const sampleHistory = sampleArchiveDoc('reception', true);
const sampleTranslation = sampleArchiveDoc('translation', true);
const sampleJosephSmith = sampleArchiveDoc('joseph-smith-statements', false);
```

- [ ] **Step 2: Register the two new samplers**

Still in `homesampler.ts`, find the `samplers` map (the object literal mapping keys to sampler fns, containing `history: sampleHistory,` and `witnesses: sampleWitnesses,`). Add two entries next to `history`:
```typescript
  history: sampleHistory,
  translation: sampleTranslation,
  josephSmith: sampleJosephSmith,
```
(Add `translation` and `josephSmith` lines; leave the rest of the map unchanged.)

- [ ] **Step 3: Add the SDL fields**

In `backend/schema/HomeSampler.graphql`, in the `HomeSampler` type (where `history: HistoricalDocument` is declared), add after it:
```graphql
  history: HistoricalDocument
  translation: HistoricalDocument
  josephSmith: HistoricalDocument
```

- [ ] **Step 4: Reload the backend, evict stale sampler cache, and verify all three archives**

The homesampler payload is cached (L2 `bom_cache`), and cached rows predate the new fields — evict them so the new samplers compute. Restart, then curl each archive across a few seeds:
```bash
systemctl --user restart bom-greenfield && sleep 5
for a in history translation josephSmith; do
  echo "== $a =="
  for s in 11 22 33; do
    curl -s -m 8 -X POST http://localhost:5006/ -H "Content-Type: application/json" \
      -d "{\"query\":\"{ homesampler(seed: $s){ $a { document money_quote mini_quote } } }\"}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['homesampler']['$a']; print('  seed $s ->', 'null' if not d else ('mq='+str(bool(d.get('money_quote')))+' mini='+str(bool(d.get('mini_quote')))+' | '+(d.get('document') or '')[:45]))"
  done
done
```
Expected: `history`, `translation`, and `josephSmith` each return a doc (non-null) with `mq=True mini=True` for at least one seed. `josephSmith` must return a doc **despite having no thumbnail**. If a cache layer serves stale (all-null) payloads even after restart, evict `homesampler` rows: the previous joseph fix used a `DELETE FROM bom_cache WHERE cache_key LIKE 'homesampler:%'` via the DB — do the equivalent (a small script or the backend's cache-clear path); do NOT print DB credentials. Re-run the curl to confirm non-null.
**Data check:** if `translation` or `josephSmith` is null across all seeds while `history` works, report BLOCKED with the archive name (the archive may lack teaser+money_quote+(thumb) rows) rather than shipping an always-null field.

- [ ] **Step 5: Commit**
```bash
git add backend/src/graphql/resolvers/homesampler.ts backend/schema/HomeSampler.graphql
git commit -m "feat(home): homesampler translation + joseph-smith archive samplers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Frontend query — request the two new sampler fields

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js` (homesampler `history { … }` selection, ~line 1858)

- [ ] **Step 1: Add the two selections**

In `frontend/webapp/src/models/GraphQLQueries.js`, find the homesampler `history` selection line:
```
        history { id slug year date source archive author document teaser citation aspect money_quote mini_quote quote_speaker quote_is_witness_voice }
```
Add two sibling lines immediately after it (same field set):
```
        history { id slug year date source archive author document teaser citation aspect money_quote mini_quote quote_speaker quote_is_witness_voice }
        translation { id slug year date source archive author document teaser citation aspect money_quote mini_quote quote_speaker quote_is_witness_voice }
        josephSmith { id slug year date source archive author document teaser citation aspect money_quote mini_quote quote_speaker quote_is_witness_voice }
```

- [ ] **Step 2: Verify the query resolves end-to-end (backend running)**
```bash
curl -s -m 10 -X POST http://localhost:5006/ -H "Content-Type: application/json" \
  -d '{"query":"{ homesampler(seed: 22){ translation { document mini_quote } josephSmith { document mini_quote } } }"}' | head -c 400
```
Expected: no GraphQL validation error; both objects present (values may be null on a given seed, but the fields resolve).

Then confirm the frontend tests are unaffected:
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles --watchAll=false
```
Expected: PASS (query-string change; no unit-test impact).

- [ ] **Step 3: Commit**
```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(home): request translation + joseph-smith docs from homesampler

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extract `ArchiveDocTile` + make HistoryTile a wrapper

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/ArchiveDocTile.jsx`
- Modify (replace contents): `frontend/webapp/src/views/Home/tiles/HistoryTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js`:
```jsx
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ArchiveDocTile from "../ArchiveDocTile";

const base = { slug: "d1", year: 1830, source: "Wayne Sentinel", document: "A Notice", citation: "Cite.", teaser: "<p>Lead here.</p> key points: <ul><li>x</li></ul>" };
const setup = (props) => render(<MemoryRouter><ArchiveDocTile heading="H" to="/x" {...props} /></MemoryRouter>);

describe("ArchiveDocTile", () => {
  test("returns null when there is no data (but renders an id-less doc)", () => {
    const { container } = setup({ data: null });
    expect(container).toBeEmptyDOMElement();
    setup({ data: { ...base, mini_quote: "a bare quote" }, image: null }); // no id
    expect(screen.getByText(/a bare quote/)).toBeInTheDocument();
  });

  test("leads with the mini quote and shows the document title", () => {
    setup({ data: { ...base, mini_quote: "I saw the plates", money_quote: "long form" }, image: null });
    expect(screen.getByText(/I saw the plates/)).toBeInTheDocument();
    expect(screen.getByText("A Notice")).toBeInTheDocument();
  });

  test("renders the image when a URL is given", () => {
    const { container } = setup({ data: { ...base, id: 7 }, image: "https://ex/img.jpg" });
    const img = container.querySelector("img.historyTileThumb");
    expect(img).toHaveAttribute("src", "https://ex/img.jpg");
  });

  test("renders NO image when image is null (translation case)", () => {
    const { container } = setup({ data: { ...base, id: 7 }, image: null });
    expect(container.querySelector("img.historyTileThumb")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles/__tests__/ArchiveDocTile.test.js --watchAll=false
```
Expected: FAIL — "Cannot find module '../ArchiveDocTile'".

- [ ] **Step 3: Create `ArchiveDocTile.jsx`**

Create `frontend/webapp/src/views/Home/tiles/ArchiveDocTile.jsx`:
```jsx
import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";
import ExpandableText from "./ExpandableText";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";

// Shared history-archive doc tile. Quote hero (mini→money→teaser) + title +
// meta + key-points + citation, with the image as an explicit prop (a thumb
// URL, a portrait URL, or null for no image). Gates on `data` — NOT `data.id`
// — so archives without thumbnails (joseph-smith) still render.
export const parseTeaser = (html) => {
  const raw = html || "";
  const bullets = [...raw.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => flatten(m[1]))
    .filter(Boolean)
    .slice(0, 4);
  const lead = flatten(raw.split(/key points:/i)[0]);
  return { lead, bullets };
};

export default function ArchiveDocTile({ data, heading, to, image }) {
  if (!data) return null;
  const meta = [data.year, data.source, data.author].filter(Boolean).join(" · ");
  const aspect = parseFloat(data.aspect) || null; // stored as height/width
  const { lead, bullets } = parseTeaser(data.teaser);
  const quote = data.mini_quote || (data.money_quote ? clampWords(data.money_quote, 14) : null);
  return (
    <RevealProvider>
      <div className="samplerTileInner historyTile">
        <h3 className="tileHeading">{heading}</h3>
        <div className="historyTileBody">
          <div className="historyTileMain">
            <Link to={to} className="historyTileTitle">{data.document}</Link>
            {meta ? <div className="historyTileMeta">{meta}</div> : null}
            {data.archive ? <div className="historyTileArchive">{flatten(data.archive)}</div> : null}
            {quote ? (
              <blockquote className="historyTileQuote">
                {data.quote_speaker && !data.quote_is_witness_voice ? (
                  <span className="historyTileQuoteBy prefix">{data.quote_speaker}:</span>
                ) : null}{" "}
                &ldquo;{quote}&rdquo;
                {data.quote_speaker && data.quote_is_witness_voice ? (
                  <cite className="historyTileQuoteBy">&mdash; {data.quote_speaker}</cite>
                ) : null}
              </blockquote>
            ) : lead ? (
              <ExpandableText className="historyTileTeaser" lines={3}>
                {lead}
              </ExpandableText>
            ) : null}
            {bullets.length ? (
              <ul className="historyTileBullets">
                {bullets.map((b, i) => (
                  <li key={i}>{clampWords(b, 16)}</li>
                ))}
              </ul>
            ) : null}
            {data.citation ? <div className="historyTileCitation">{flatten(data.citation)}</div> : null}
          </div>
          {image ? (
            <Link to={to} className="historyTileThumbLink" aria-label={data.document || ""}>
              <img
                className="historyTileThumb"
                style={aspect ? { aspectRatio: `1 / ${aspect}` } : undefined}
                src={image}
                alt={data.document || ""}
                loading="lazy"
                onError={(e) => (e.target.style.display = "none")}
              />
            </Link>
          ) : null}
        </div>
        <TileDeepLink to={to}>{label("view_in_context")}</TileDeepLink>
      </div>
    </RevealProvider>
  );
}
```

- [ ] **Step 4: Make `HistoryTile.js` a thin wrapper (reception)**

Replace the ENTIRE contents of `frontend/webapp/src/views/Home/tiles/HistoryTile.js` with:
```jsx
import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import ArchiveDocTile, { parseTeaser } from "./ArchiveDocTile";

// Backward-compat: parseTeaser used to live here.
export { parseTeaser };

// The reception-archive tile: featured document with its facsimile thumbnail.
export default function HistoryTile({ data }) {
  if (!data) return null;
  const to = data.slug ? `/history/${data.slug}` : "/history";
  const image = data.id ? `${assetUrl}/history/thumbs/${String(data.id).padStart(4, "0")}` : null;
  return <ArchiveDocTile data={data} heading={label("history")} to={to} image={image} />;
}
```

- [ ] **Step 5: Run the ArchiveDocTile test + the existing HistoryTile test**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles --watchAll=false
```
Expected: the new `ArchiveDocTile` tests PASS and the existing `HistoryTile.test.js` tests still PASS (the fallback ladder now runs through the wrapper → ArchiveDocTile). If `HistoryTile.test.js` imported `parseTeaser` from `../HistoryTile`, the re-export keeps it working; if it fails on the `!data?.id` gate (an old test may have relied on returning null without an id), update that test to reflect the new gate (`!data`) — report any such change.

- [ ] **Step 6: Commit**
```bash
git add frontend/webapp/src/views/Home/tiles/ArchiveDocTile.jsx frontend/webapp/src/views/Home/tiles/HistoryTile.js frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js
git commit -m "refactor(home): extract shared ArchiveDocTile; HistoryTile is a wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Translation + Joseph-Smith tiles + registry

**Files:**
- Create: `frontend/webapp/src/views/Home/tiles/TranslationTile.js`
- Create: `frontend/webapp/src/views/Home/tiles/JosephSmithTile.js`
- Modify: `frontend/webapp/src/views/Home/tiles/registry.js`
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js` (add wrapper assertions)

- [ ] **Step 1: Write the failing wrapper tests**

Add to `frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js` (new describe block; import the wrappers):
```jsx
import TranslationTile from "../TranslationTile";
import JosephSmithTile from "../JosephSmithTile";

describe("archive tile wrappers", () => {
  const doc = { slug: "d1", document: "A Doc", mini_quote: "a quote", citation: "C." };
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

  test("TranslationTile renders the quote with NO image and links to the section", () => {
    const { container } = wrap(<TranslationTile data={{ ...doc, id: 9 }} />);
    expect(screen.getByText(/a quote/)).toBeInTheDocument();
    expect(container.querySelector("img.historyTileThumb")).toBeNull(); // no image
    expect(container.querySelector("a.historyTileTitle")).toHaveAttribute("href", "/history/translation");
  });

  test("JosephSmithTile renders the portrait and links to the section", () => {
    const { container } = wrap(<JosephSmithTile data={doc} />); // no id
    expect(screen.getByText(/a quote/)).toBeInTheDocument();
    const img = container.querySelector("img.historyTileThumb");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toMatch(/joseph-smith\.jpg$/);
    expect(container.querySelector("a.historyTileTitle")).toHaveAttribute("href", "/history/joseph-smith");
  });
});
```

- [ ] **Step 2: Run to verify it fails**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles/__tests__/ArchiveDocTile.test.js --watchAll=false
```
Expected: FAIL — cannot find `../TranslationTile` / `../JosephSmithTile`.

- [ ] **Step 3: Create the two wrappers**

Create `frontend/webapp/src/views/Home/tiles/TranslationTile.js`:
```jsx
import React from "react";
import ArchiveDocTile from "./ArchiveDocTile";

// Translation-archive tile — no image (per direction), links to the feed.
export default function TranslationTile({ data }) {
  return <ArchiveDocTile data={data} heading="Translation" to="/history/translation" image={null} />;
}
```

Create `frontend/webapp/src/views/Home/tiles/JosephSmithTile.js`:
```jsx
import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import ArchiveDocTile from "./ArchiveDocTile";

// Joseph-Smith-statements tile — the portrait (these docs have no thumbnail),
// links to the witnesses-format page.
export default function JosephSmithTile({ data }) {
  return (
    <ArchiveDocTile
      data={data}
      heading="Joseph Smith"
      to="/history/joseph-smith"
      image={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`}
    />
  );
}
```

- [ ] **Step 4: Register both tiles in the reserve pool**

In `frontend/webapp/src/views/Home/tiles/registry.js`:
(a) Add imports near the other tile imports at the top:
```javascript
import TranslationTile from "./TranslationTile";
import JosephSmithTile from "./JosephSmithTile";
```
(b) In the `reservePool` array, add two entries (next to the `witness` entry):
```javascript
  { key: "translation", component: TranslationTile, dataKey: "translation", isReady: (p) => !!p?.translation },
  { key: "josephSmith",  component: JosephSmithTile,  dataKey: "josephSmith", isReady: (p) => !!p?.josephSmith },
```
(Sampler's `renderReserve` sets `props.data = payload[dataKey]`, so these receive the sampled doc as `data`, matching the `witness` contract.)

- [ ] **Step 5: Run the tile tests + the Home tiles suite**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles --watchAll=false
```
Expected: all PASS.

- [ ] **Step 6: Visual check (best-effort)**
The reserve tiles surface via the balancer, so they may not appear on every home load. Load `http://localhost:8200/` in headless Chromium a few times and check for `.tile-translation` / `.tile-josephSmith`; when present, confirm the translation tile shows a quote with **no thumbnail** and the joseph tile shows the **portrait**. Because appearance is balancer-dependent, this is best-effort — the unit tests are the hard gate. Report what you observe.

- [ ] **Step 7: Commit**
```bash
git add frontend/webapp/src/views/Home/tiles/TranslationTile.js frontend/webapp/src/views/Home/tiles/JosephSmithTile.js frontend/webapp/src/views/Home/tiles/registry.js frontend/webapp/src/views/Home/tiles/__tests__/ArchiveDocTile.test.js
git commit -m "feat(home): translation + joseph-smith archive tiles (reserve pool)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Home tiles suite:**
```bash
cd frontend/webapp
CI=true npx react-scripts test src/views/Home/tiles --watchAll=false
```
Expected: all PASS.

- [ ] **Backend** — `homesampler` returns `history`, `translation`, and `josephSmith` docs (Task 1 curl), joseph despite no thumbnail.

- [ ] **End-to-end** at `http://localhost:8200/` — over a few loads, the translation tile (no image) and joseph tile (portrait) appear alongside the reception (HistoryTile) and witness tiles.

---

## Self-Review (against the spec)

**Spec coverage:**
- Backend samplers (translation + joseph, joseph without thumb) → Task 1 ✅
- SDL fields → Task 1 ✅
- Query selections → Task 2 ✅
- Shared `ArchiveDocTile` (gate on data, image prop, no-image path) → Task 3 ✅
- HistoryTile wrapper (reception thumb) + parseTeaser re-export → Task 3 ✅
- TranslationTile (no image) + JosephSmithTile (portrait) → Task 4 ✅
- Registry reserve-pool entries (dataKey contract) → Task 4 ✅
- Tests (tile image/no-image/gate/ladder; wrapper image+link; backend surfacing) → Tasks 1,3,4 ✅
- WitnessTile untouched → confirmed (not in any task) ✅

**Placeholder scan:** none — concrete code/commands throughout. The Task-1 cache-eviction fallback references the prior joseph fix's approach without printing credentials — a real operational note, not a placeholder.

**Type/name consistency:** `sampleArchiveDoc(archive, requireThumb)` used by all three bindings; sampler keys (`translation`, `josephSmith`) match the SDL fields, the query selections, and the registry `dataKey`s. `ArchiveDocTile({data, heading, to, image})` prop names match the three wrappers (Tasks 3,4) and the tests. `parseTeaser` re-exported from HistoryTile for backward compat.
