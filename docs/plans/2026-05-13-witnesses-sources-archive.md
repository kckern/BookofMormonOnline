# Witnesses sources archive — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `bom_xtras_history` rows tagged `archive='witnesses'` into the `/history/witnesses/:witness` detail page as a Masonry grid of source cards that open in the existing history PopUp; keep the witness superstructure (list, groupings, statements) hardcoded inline.

**Architecture:** Pure extension of existing `history` GraphQL query — adds `archive` and `principal` filter args; the Sequelize model gains the columns the schema added but the model never declared. Frontend `History.js` and a new fetch in `Witnesses.js`'s `SingleWitness` both consume the same query via an updated `GraphQLQueries.js` builder that accepts object-shaped input. Modal reuse: zero new popup code — `PopUp.js:114` already handles `type === "history"`.

**Tech Stack:** TypeScript + Sequelize + Apollo GraphQL (backend); React 17 + reactstrap + react-masonry-css (frontend).

**Source spec:** `docs/specs/2026-05-13-witnesses-sources-archive.md`

**Commit policy:** Per project convention, do NOT commit unless the user explicitly authorizes. Commit checkpoints in this plan are logical group boundaries — surface them to the user before running `git commit`.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/database/models/bom_xtras_history.ts` | Modify | Declare 9 missing columns: `guid`, `archive`, `event_year`, `event_date`, `repository`, `archive_id`, `principal`, `language`, `metadata` |
| `src/typeDefs/BomNotes.ts` | Modify | Add `archive`/`principal`/`event_year`/`event_date` to `HistoricalDocument`; extend `history` query signature with `archive: String, principal: [String]` |
| `src/resolvers/BomNotes.ts` | Modify | Extend `history` resolver where-clause to honor new args (lines 93–102) |
| `frontend/webapp/src/models/GraphQLQueries.js` | Modify | Replace `history` query builder (lines 553–578) with multi-arg version |
| `frontend/webapp/src/views/History/History.js` | Modify | Pass `{ archive: "reception" }` to `BoMOnlineAPI` call (line 59) |
| `frontend/webapp/src/views/History/Witnesses.js` | Modify | Add `principalNames` field to each inline witness; delete Josiah Stoal inline `sources[]`; extend `SingleWitness` to fetch + render source cards + handle `:source` deep-link |
| `frontend/webapp/src/views/History/Witnesses.css` | Modify | Add styles for `.witness-sources` masonry container |
| `scripts/describe-history.ts` | Keep | Schema-discovery script; useful for future column drift |

---

## Task 1: Extend Sequelize model with new columns

**Files:**
- Modify: `src/database/models/bom_xtras_history.ts`

- [ ] **Step 1.1: Add new column declarations**

After the existing `aspect` declaration (around line 71), add inside the `this.init({...}` definitions object — BEFORE the closing brace at line 72:

```ts
guid: {
  type: DataTypes.CHAR(10),
  allowNull: true
},
archive: {
  type: DataTypes.STRING(255),
  allowNull: true
},
event_year: {
  type: DataTypes.INTEGER,
  allowNull: true
},
event_date: {
  type: DataTypes.STRING(255),
  allowNull: true
},
repository: {
  type: DataTypes.STRING(255),
  allowNull: true
},
archive_id: {
  type: DataTypes.STRING(128),
  allowNull: true
},
principal: {
  type: DataTypes.TEXT,
  allowNull: true
},
language: {
  type: DataTypes.CHAR(8),
  allowNull: true,
  defaultValue: 'en'
},
metadata: {
  type: DataTypes.JSON,
  allowNull: true
},
```

- [ ] **Step 1.2: Add the two new indexes inside the `indexes` array**

After the existing `transcript` FULLTEXT index entry (around line 113), add:

```ts
{
  name: "idx_archive",
  using: "BTREE",
  fields: [{ name: "archive" }]
},
{
  name: "idx_event_year",
  using: "BTREE",
  fields: [{ name: "event_year" }]
},
```

- [ ] **Step 1.3: Verify the file still type-checks (no errors thrown at backend startup)**

Run: `systemctl --user restart bom-dev && sleep 5 && journalctl --user -u bom-dev -n 50 --no-pager | grep -i "error\|database"`
Expected: `Database connected successfully` and no Sequelize errors mentioning `bom_xtras_history`.

---

## Task 2: Extend HistoricalDocument GraphQL type

**Files:**
- Modify: `src/typeDefs/BomNotes.ts`

- [ ] **Step 2.1: Add new fields to the `HistoricalDocument` type**

Edit lines 64–80 (`type HistoricalDocument { ... }`). The full replacement:

```graphql
type HistoricalDocument {
  seq: Int
  id: Int
  slug: String
  year: Int
  date: String
  link: String
  type: String
  source: String
  author: String
  document: String
  pages: Int
  citation: String
  teaser: String
  transcript: String
  aspect: Float
  archive: String
  principal: String
  event_year: Int
  event_date: String
}
```

- [ ] **Step 2.2: Extend the `history` query signature**

Edit line 14 in the same file:

Before:
```graphql
history(slug: [String]): [HistoricalDocument]
```

After:
```graphql
history(slug: [String], archive: String, principal: [String]): [HistoricalDocument]
```

- [ ] **Step 2.3: Verify the schema reloads cleanly**

Run: `systemctl --user restart bom-dev && sleep 5 && journalctl --user -u bom-dev -n 30 --no-pager | grep -iE "error|schema"`
Expected: no Apollo schema errors. If you see `Syntax Error` or `Unknown type`, re-check the diff.

---

## Task 3: Extend `history` resolver where-clause

**Files:**
- Modify: `src/resolvers/BomNotes.ts`

- [ ] **Step 3.1: Replace the `history` resolver body**

Edit lines 93–102. Before:

```ts
history: async (root: any, args: any, context: any, info: any) => {
  const lang = context.lang ? context.lang : null;
  let conditions = {
    where: {slug:args.slug},
    order: ['seq'],
    include: [includeTranslation({ [Op.or]: ['source','author','document','citation','teaser','transcript'] }, lang)].filter(x => !!x)
  };
  if(!args.slug) delete conditions.where;
  return Models.BomXtrasHistory.findAll(conditions);
},
```

After:

```ts
history: async (root: any, args: any, context: any, info: any) => {
  const lang = context.lang ? context.lang : null;
  const where: any = {};
  if (args.slug)      where.slug      = args.slug;
  if (args.archive)   where.archive   = args.archive;
  if (args.principal) where.principal = { [Op.in]: args.principal };
  const conditions: any = {
    order: ['seq'],
    include: [includeTranslation({ [Op.or]: ['source','author','document','citation','teaser','transcript'] }, lang)].filter(x => !!x)
  };
  if (Object.keys(where).length) conditions.where = where;
  return Models.BomXtrasHistory.findAll(conditions);
},
```

- [ ] **Step 3.2: Verify backend reload**

Run: `systemctl --user restart bom-dev && sleep 5 && journalctl --user -u bom-dev -n 30 --no-pager | tail -20`
Expected: clean startup, no TypeScript errors mentioning BomNotes.

---

## Task 4: Verify backend end-to-end via curl

- [ ] **Step 4.1: Confirm `archive` filter works**

Run:
```bash
curl -s -X POST http://localhost:5005/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ history(archive: \"witnesses\") { slug principal archive } }"}' \
  | head -c 500
```

Expected: a JSON array of records where every entry has `"archive":"witnesses"`. Should be 470 records total (don't print them all — just verify the first few).

- [ ] **Step 4.2: Confirm `principal` filter works**

Run:
```bash
curl -s -X POST http://localhost:5005/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ history(archive: \"witnesses\", principal: [\"Hiram Page\", \"Eight Witnesses\"]) { slug principal document } }"}' \
  | head -c 1500
```

Expected: 17 records (8 Hiram Page + 9 Eight Witnesses), each with `principal` matching one of the two values.

- [ ] **Step 4.3: Confirm legacy slug query still works**

Run:
```bash
curl -s -X POST http://localhost:5005/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ history(slug: [\"1832-11-16-mormonism\"]) { slug document } }"}'
```

Expected: 1 record for `1832-11-16-mormonism` — confirms the legacy call shape is preserved.

- [ ] **Step 4.4: COMMIT CHECKPOINT — backend complete**

Surface to user. Suggested commit message:
```
feat(history): add archive + principal filters; sync bom_xtras_history model

- Add archive, principal, event_year, event_date, guid, repository,
  archive_id, language, metadata columns to Sequelize model
- Expose archive/principal/event_year/event_date on HistoricalDocument
- Extend history query with archive: String, principal: [String] args
```

---

## Task 5: Extend GraphQLQueries.js `history` builder

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`

- [ ] **Step 5.1: Replace the `history` query builder**

Edit lines 553–578. Before:

```js
history: (slugs) => {
  return {
    type: "history",
    key: "slug",
    val: slugs,
    query:
      q("history", "slug", slugs) +
      `{
        seq
        id
        slug
        year
        date
        link
        type
        source
        author
        document
        citation
        teaser
        aspect
        pages
        ${(slugs) ? "transcript" : ""}
       }`,
  }
},
```

After:

```js
history: (input) => {
  const isObject = input && typeof input === 'object' && !Array.isArray(input);
  const slug      = isObject ? input.slug      : (input === true ? null : input);
  const archive   = isObject ? input.archive   : null;
  const principal = isObject ? input.principal : null;

  const argFragments = [];
  if (slug != null && slug !== false) {
    const v = Array.isArray(slug) && slug.length === 1 ? slug[0] : slug;
    argFragments.push(`slug: ${JSON.stringify(v)}`);
  }
  if (archive) {
    argFragments.push(`archive: ${JSON.stringify(archive)}`);
  }
  if (principal) {
    const p = Array.isArray(principal) ? principal : [principal];
    argFragments.push(`principal: ${JSON.stringify(p)}`);
  }
  const args = argFragments.length ? `(${argFragments.join(', ')})` : '';
  const wantsTranscript = !!slug;

  return {
    type: "history",
    key: "slug",
    val: slug,
    query: `history ${args} {
      seq
      id
      slug
      year
      date
      link
      type
      source
      author
      document
      citation
      teaser
      aspect
      pages
      archive
      principal
      event_year
      event_date
      ${wantsTranscript ? 'transcript' : ''}
    }`,
  }
},
```

- [ ] **Step 5.2: Sanity-check legacy callers still work**

Search for existing call shapes:

```bash
grep -rn "BoMOnlineAPI.*history" frontend/webapp/src/ | head -20
```

Expected call shapes that must keep working:
- `BoMOnlineAPI({ history: true })` in `History.js:59` — will be replaced in Task 6, but should still resolve before that.
- `BoMOnlineAPI({ history: slug })` in `PopUp.js:655` — single slug string lookup.

The new builder handles both: `true` → no args (returns all), string → `slug: "..."`.

---

## Task 6: Update History.js to filter by archive

**Files:**
- Modify: `frontend/webapp/src/views/History/History.js`

- [ ] **Step 6.1: Change the BoMOnlineAPI call**

Edit line 59. Before:

```js
BoMOnlineAPI({ history: true, markdown: "history" }).then(r => {  
```

After:

```js
BoMOnlineAPI({ history: { archive: "reception" }, markdown: "history" }).then(r => {  
```

- [ ] **Step 6.2: Manually verify /history page still renders**

Open `http://localhost:8200/history` in a browser. Confirm: document grid still renders (≥ 500 reception-archive items), thumbnails load, clicking a card opens the existing popup.

Caveat: per CLAUDE.md, `bom.kckern.net` is Cloudflare-cached for 4h — always test via `localhost:8200`.

---

## Task 7: Add `principalNames` to inline witness data and remove Josiah Stoal sources

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js`

- [ ] **Step 7.1: Update the inline `data` object**

Edit lines 8–151. Replace the entire `const data = { ... }` block with:

```js
const data = {
    "three-witnesses": [
        {
            "slug": "martin-harris",
            "name": "Martin Harris",
            "birthday": "1783-05-18",
            "bio": "",
            "principalNames": ["Martin Harris", "Three Witnesses"]
        },
        {
            "slug": "oliver-cowdery",
            "name": "Oliver Cowdery",
            "birthday": "1806-10-03",
            "bio": "",
            "principalNames": ["Oliver Cowdery", "Three Witnesses"]
        },
        {
            "slug": "david-whitmer",
            "name": "David Whitmer",
            "birthday": "1805-01-07",
            "bio": "",
            "principalNames": ["David Whitmer", "Three Witnesses"]
        }
    ],
    "eight-witnesses": [
        {
            "slug": "john-whitmer",
            "name": "John Whitmer",
            "birthday": "1802-08-27",
            "bio": "",
            "principalNames": ["John Whitmer", "Eight Witnesses"]
        },
        {
            "slug": "jacob-whitmer",
            "name": "Jacob Whitmer",
            "birthday": "1800-01-27",
            "bio": "",
            "principalNames": ["Jacob Whitmer", "Eight Witnesses"]
        },
        {
            "slug": "christian-whitmer",
            "name": "Christian Whitmer",
            "birthday": "1798-01-18",
            "bio": "",
            "principalNames": ["Christian Whitmer", "Christian Whitmer and Peter Whitmer, Jr.", "Eight Witnesses"]
        },
        {
            "slug": "peter-whitmer-jr",
            "name": "Peter Whitmer Jr.",
            "birthday": "1809-09-27",
            "bio": "",
            "principalNames": ["Peter Whitmer Jr.", "Peter Whitmer, Jr.", "Christian Whitmer and Peter Whitmer, Jr.", "Eight Witnesses"]
        },
        {
            "slug": "hiram-page",
            "name": "Hiram Page",
            "birthday": "1800",
            "bio": "",
            "principalNames": ["Hiram Page", "Eight Witnesses"]
        },
        {
            "slug": "joseph-smith-sr",
            "name": "Joseph Smith Sr.",
            "birthday": "1771-07-12",
            "bio": "",
            "principalNames": ["Joseph Smith Sr.", "Eight Witnesses"]
        },
        {
            "slug": "samuel-smith",
            "name": "Samuel Smith",
            "birthday": "1808-03-13",
            "bio": "",
            "principalNames": ["Samuel H. Smith", "Eight Witnesses"]
        },
        {
            "slug": "hyrum-smith",
            "name": "Hyrum Smith",
            "birthday": "1800-02-09",
            "bio": "",
            "principalNames": ["Hyrum Smith", "Eight Witnesses"]
        }
    ],
    "other-witnesses": [
        {
            "slug": "william-smith",
            "name": "William Smith",
            "birthday": "1811-03-13",
            "bio": "",
            "principalNames": ["William Smith", "William B. Smith"]
        },
        {
            "slug": "mary-whitmer",
            "name": "Mary Whitmer",
            "birthday": "1778-08-27",
            "bio": "",
            "principalNames": ["Mary Whitmer"]
        },
        {
            "slug": "lucy-mack-smith",
            "name": "Lucy Mack Smith",
            "birthday": "1775-07-08",
            "bio": "",
            "principalNames": ["Lucy Mack Smith"]
        },
        {
            "slug": "katherine-smith",
            "name": "Katherine Smith",
            "birthday": "1813-07-28",
            "bio": "",
            "principalNames": ["Katherine"]
        },
        {
            "slug": "josiah-stoal",
            "name": "Josiah Stoal",
            "birthday": "1771",
            "bio": "",
            "principalNames": ["Josiah Stowell"]
        },
        {
            "slug": "emma-smith",
            "name": "Emma Smith",
            "birthday": "1804-07-10",
            "bio": "",
            "principalNames": ["Emma Smith"]
        },
        {
            "slug": "william-hussey-azel-vandruver",
            "name": "William T. Hussey and Azel Vandruver",
            "birthday": "1800",
            "bio": "",
            "principalNames": []
        },
        {
            "slug": "willard-chase",
            "name": "Willard Chase",
            "birthday": "1800",
            "bio": "",
            "principalNames": ["Willard Chase"]
        }
    ]
}
```

Note: this removes Josiah Stoal's `sources[]` array entirely — that data now lives in the database.

- [ ] **Step 7.2: Verify the index page (`/history/witnesses`) is visually unchanged**

Open `http://localhost:8200/history/witnesses` in a browser. Three sections render with portraits, names, ages, statements — identical to before the change.

---

## Task 8: Extend SingleWitness with sources grid

**Files:**
- Modify: `frontend/webapp/src/views/History/Witnesses.js`
- Modify: `frontend/webapp/src/views/History/Witnesses.css`

- [ ] **Step 8.1: Add new imports at the top of Witnesses.js**

Edit lines 1–7. The full imports block becomes:

```js
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Masonry from 'react-masonry-css';
import Parser from 'html-react-parser';
import './Witnesses.css';
import { label } from '../../models/Utils';
import BoMOnlineAPI, { assetUrl } from 'src/models/BoMOnlineAPI';
import moment from 'moment';
```

Removed: `useRouteMatch`, `Button` (both unused).

- [ ] **Step 8.2: Replace the SingleWitness component**

Edit lines 155–178. Replace the entire component:

```js
const SingleWitness = ({ witness, sourceSlug, appController }) => {

    const [sources, setSources] = useState(null);

    useEffect(() => {
        const handleEsc = (event) => { if (event.keyCode === 27) window.history.back(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        if (!witness?.principalNames?.length) {
            setSources([]);
            return;
        }
        BoMOnlineAPI({
            history: { archive: "witnesses", principal: witness.principalNames }
        }).then(r => setSources(r.history || []));
    }, [witness?.slug]);

    useEffect(() => {
        if (!sourceSlug || !sources?.length || !appController) return;
        const doc = sources.find(s => s.slug === sourceSlug);
        if (!doc) return;
        appController.functions.setPopUp({
            type: "history",
            ids: [doc.slug],
            popUpData: doc,
            underSlug: `history/witnesses/${witness.slug}`,
            vhtop: 10,
        });
    }, [sourceSlug, sources, appController, witness?.slug]);

    const displayDate = (date) => {
        if (!date) return '';
        const len = date.length;
        return moment(date, [(len === 4) ? "YYYY" : 'YYYY-MM-DD']).format(
            (len === 4) ? label("history_date_format_year")
            : (len === 7) ? label("history_date_format_month")
            : label("history_date_format_full")
        );
    };

    const breakpointColumnsObj = { default: 4, 1400: 3, 1100: 2, 800: 1 };

    const openSource = (doc) => {
        if (!appController) return;
        appController.functions.setPopUp({
            type: "history",
            ids: [doc.slug],
            popUpData: doc,
            underSlug: `history/witnesses/${witness.slug}`,
            vhtop: 10,
        });
    };

    return <div className="container" style={{ display: 'block' }}>
        <div id="page" className='single-witnesses'>
            <Link to='/history/witnesses' className='btn btn-primary'>Back</Link>
            <h3 className="title lg-4 text-center">{witness.name}</h3>
            <div className='witness-image'>
                <img src={`${assetUrl}/history/witnesses/people/${witness.slug}.jpg`} alt={witness.name} />
            </div>
            {witness.bio && <div className='witness-bio'>{witness.bio}</div>}

            <div className='witness-sources'>
                {sources === null && <div className='witness-sources-loading'>Loading sources…</div>}
                {sources && sources.length === 0 && (
                    <div className='witness-sources-empty'>No sources available for this witness.</div>
                )}
                {sources && sources.length > 0 && (
                    <Masonry
                        breakpointCols={breakpointColumnsObj}
                        className="my-masonry-grid"
                        columnClassName="my-masonry-grid_column">
                        {sources.map((doc, i) => (
                            <div
                                key={doc.slug || i}
                                className='historycard card'
                                onClick={() => openSource(doc)}
                            >
                                <div className='card-header text-left'>
                                    <div className='sourcebox'>
                                        <div className='pub'>{doc.source}</div>
                                        <div className='date'>{displayDate(doc.date)}</div>
                                    </div>
                                </div>
                                <div className='thumbbox'>
                                    {doc.id && (
                                        <img
                                            style={{ aspectRatio: "1 / " + (parseFloat(doc.aspect) || 1) }}
                                            src={`${assetUrl}/history/thumbs/${String(doc.id).padStart(4, '0')}`}
                                            alt={doc.document}
                                        />
                                    )}
                                    {doc.teaser && <div className='thumb_teaser'>{Parser(doc.teaser)}</div>}
                                </div>
                                <h5>{doc.document}</h5>
                                {doc.citation && <div className='citation'>{Parser(doc.citation + "")}</div>}
                            </div>
                        ))}
                    </Masonry>
                )}
            </div>
        </div>
    </div>;
};
```

Key design choices:
- Mirrors `History.js:110–138` card markup so existing `.historycard` styles apply.
- Empty `principalNames: []` (e.g., Hussey/Vandruver) short-circuits the fetch and shows the empty-state message.
- `:source` deep-link only triggers `setPopUp` once sources arrive (effect depends on `sources`).
- ESC handler preserved from the original.

- [ ] **Step 8.3: Thread `appController` and `source` param through the parent Witnesses component**

Edit lines 181–190. Replace:

```js
const Witnesses = () => {

    const dateofWitness = `1829-06-28`;

    const {witness,source} = useParams();
    if(witness){
        const dataKeys = Object.keys(data);
        const witnessData = dataKeys.map(key => data[key].find(w => w.slug === witness)).find(w => w);
        return <SingleWitness witness={witnessData} />
    }
```

With:

```js
const Witnesses = ({ appController }) => {

    const dateofWitness = `1829-06-28`;

    const { witness, source } = useParams();
    if (witness) {
        const dataKeys = Object.keys(data);
        const witnessData = dataKeys.map(key => data[key].find(w => w.slug === witness)).find(w => w);
        if (!witnessData) return <div className="container"><div id="page"><Link to='/history/witnesses' className='btn btn-primary'>Back</Link><p>Witness not found.</p></div></div>;
        return <SingleWitness witness={witnessData} sourceSlug={source} appController={appController} />;
    }
```

Added: `appController` prop destructure (passed automatically by `Main.js:140`), `sourceSlug` and `appController` props to `SingleWitness`, plus a "not found" fallback so an unknown slug doesn't crash on `witness.name`.

- [ ] **Step 8.4: Add CSS for the new sources container**

Append to `frontend/webapp/src/views/History/Witnesses.css`:

```css
.single-witnesses .witness-sources {
    margin-top: 2rem;
}

.single-witnesses .witness-sources-loading,
.single-witnesses .witness-sources-empty {
    text-align: center;
    color: #777;
    padding: 2rem 1rem;
}

.single-witnesses .witness-sources .my-masonry-grid {
    display: flex;
    margin-left: -1rem;
    width: auto;
}

.single-witnesses .witness-sources .my-masonry-grid_column {
    padding-left: 1rem;
    background-clip: padding-box;
}

.single-witnesses .witness-sources .historycard {
    margin-bottom: 1rem;
    cursor: pointer;
}
```

Note: the existing `.historycard` styles in `History.css` define internal card chrome — confirm they apply (cards are siblings of `.historycard` class). If not, copy the relevant rules into `Witnesses.css` scoped under `.single-witnesses`.

- [ ] **Step 8.5: Manual verification — Hiram Page**

Open `http://localhost:8200/history/witnesses/hiram-page`. Expect:
- Back button, "Hiram Page" title, portrait, no bio block
- "Sources" Masonry grid with 17 cards (8 Hiram + 9 Eight Witnesses), each showing publication name, date, optional thumb, document title, citation
- Clicking any card opens the existing history PopUp showing the full document including transcript

- [ ] **Step 8.6: Manual verification — Martin Harris (high-volume case)**

Open `http://localhost:8200/history/witnesses/martin-harris`. Expect ~90 cards (87 Martin Harris + 3 Three Witnesses). Confirm Masonry layout doesn't break with high card count.

- [ ] **Step 8.7: Manual verification — empty case**

Open `http://localhost:8200/history/witnesses/william-hussey-azel-vandruver`. Expect: portrait + "No sources available for this witness." message instead of the grid.

- [ ] **Step 8.8: Manual verification — deep-link**

Open `http://localhost:8200/history/witnesses/josiah-stoal/1832-11-16-mormonism`. Expect: page loads to Josiah Stoal's detail view AND the history popup auto-opens to the Morning Star "Mormonism" document.

If the popup doesn't open: confirm the source slug is among Josiah's fetched sources (he should have 6 from the DB). If `1832-11-16-mormonism` isn't one of those 6, pick another slug from the live data for the test.

- [ ] **Step 8.9: Manual verification — `/history` page regression**

Open `http://localhost:8200/history`. Expect: identical to before — reception-archive cards only, no broken images from witness rows leaking in.

---

## Task 9: Final cleanup and commit

- [ ] **Step 9.1: Lint check**

Run: `cd frontend/webapp && npx eslint src/views/History/Witnesses.js src/views/History/Witnesses.css src/views/History/History.js src/models/GraphQLQueries.js 2>&1 | head -40`

Expected: no new errors. Existing warnings about unrelated files are fine.

- [ ] **Step 9.2: Backend type-check**

Run: `cd /home/bom/BookofMormonOnline && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "BomNotes|bom_xtras_history" | head -20`

Expected: empty output (no errors in our touched files).

- [ ] **Step 9.3: COMMIT CHECKPOINT — frontend complete**

Surface to user. Suggested commit message:

```
feat(witnesses): wire bom_xtras_history sources into witness detail page

- Extend GraphQLQueries.js history builder with archive/principal args
- Filter History.js to archive="reception" (excludes witness rows)
- Add principalNames mapping to inline witness data
- SingleWitness fetches witness sources + renders Masonry grid of cards
- Wire :source URL param to auto-open the existing history PopUp
- Drop Josiah Stoal inline sources[] (now backend-driven)
```

---

## Acceptance checklist (mirrors spec)

- [ ] `bom_xtras_history` Sequelize model declares all current table columns (Task 1)
- [ ] GraphQL `history` query accepts optional `archive` and `principal` args; legacy callers unaffected (Tasks 2–3, verified Task 4)
- [ ] `HistoricalDocument` type exposes `archive`, `principal`, `event_year`, `event_date` (Task 2)
- [ ] `/history/witnesses/hiram-page` renders portrait + bio + grid of source cards from DB (Task 8.5)
- [ ] Source card click opens existing history PopUp (Task 8.5)
- [ ] `/history/witnesses/<slug>/<source-slug>` auto-opens the popup (Task 8.8)
- [ ] `/history/witnesses` index page visually unchanged (Task 7.2)
- [ ] `/history` reception page visually unchanged (Task 8.9)
- [ ] Each non-empty `principalNames` witness returns ≥1 source for high-traffic principals (Task 8.5, 8.6)

---

## Notes for the executor

- **Sandbox mode:** `bom-dev` runs against a read-only DB user. This entire feature is read-only — no INSERT/UPDATE — so sandbox guards don't apply.
- **Cloudflare cache:** test exclusively against `http://localhost:8200`. The `bom.kckern.net` URL serves stale bundles for up to 4 hours.
- **Restart cycle:** backend changes (Tasks 1–3) require `systemctl --user restart bom-dev`. Frontend changes hot-reload via CRA.
- **Auth state:** sandbox mode intentionally doesn't persist auth — login flows that require state won't work in dev, but this feature doesn't touch auth.
- **Logs:** `journalctl --user -u bom-dev -f` for live tailing.
