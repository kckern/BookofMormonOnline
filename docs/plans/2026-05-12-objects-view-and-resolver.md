# Objects View & Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filterable Objects index, Object detail popup, and passagenotes integration backed by the new `bom_objects` / `bom_xrels` / `type='object'` data — mirroring the existing People/Places pattern.

**Spec:** `docs/specs/2026-05-12-objects-view-and-resolver.md` is the source of truth for design decisions; read it before starting Task 1.

**Architecture:** Backend follows the Sequelize-only convention from `src/resolvers/BomPeoplePlace.ts` — AST-driven selective translation, exported helpers for cross-resolver use, no raw SQL. The xrels field resolver does programmatic batch lookup against three target tables. Frontend mirrors `frontend/webapp/src/views/Places/` with a 5-axis chip filter and a new `Object` branch in the shared `PopUp.js`. The existing `passagenotes` resolver is extended to surface objects alongside people/places.

**Tech Stack:** TypeScript + Sequelize + Apollo Server (backend), React 17 + Redux + react-router v5 + react-masonry-css + reactstrap (frontend).

**Testing convention:** The project has "minimal test coverage" per CLAUDE.md. This plan uses **manual smoke checks** rather than automated TDD — every task ends with a runnable verification step that the implementer must execute and observe before committing. No new test infrastructure is introduced.

**Restart loop after every backend task:** the dev backend runs as `systemctl --user` service `bom-dev`. After backend file changes, restart with `systemctl --user restart bom-dev && journalctl --user -u bom-dev -f --since '30s ago'` and watch for the `Apollo Server ready` log line before issuing GraphQL probes. Frontend HMR picks up frontend changes automatically.

**Database prerequisite:** the SQL pipeline that populated `bom_objects` / `bom_xrels` / additional `bom_index` rows must already have been applied. Verify with the probe in Task 1 Step 1 before proceeding.

---

## File map

**Backend — new:**
- `src/database/models/bom_objects.ts`
- `src/database/models/bom_xrels.ts`
- `src/typeDefs/BomObjects.ts`
- `src/resolvers/BomObjects.ts`

**Backend — modified:**
- `src/database/typings/Models.d.ts` — add 2 entries
- `src/config/database.ts` — import + register 2 models
- `src/typeDefs/index.ts` — register `BomObjects` typeDef
- `src/typeDefs/BomNotes.ts` — add `objects: [Object]` to `PassageNotes`
- `src/resolvers/index.ts` — register `BomObjects` resolver
- `src/resolvers/BomNotes.ts` — extend `passagenotes` to populate `objects`

**Frontend — new:**
- `frontend/webapp/src/views/Objects/Objects.js`
- `frontend/webapp/src/views/Objects/Objects.css`
- `frontend/webapp/src/views/Objects/ObjectsFilter.js`
- `frontend/webapp/src/views/Objects/objectsFilterData.js`
- `frontend/webapp/src/views/Objects/svg/` (15 SVG files)

**Frontend — modified:**
- `frontend/webapp/src/models/GraphQLQueries.js` — add `object`, `objectList`, extend `passagenotes`
- `frontend/webapp/src/models/appController.js:363` — extend preload gate
- `frontend/webapp/src/models/Routes.js` — add `/objects` routes + lazy import
- `frontend/webapp/src/views/_Common/PopUp.js` — add `Object` component + dispatch branch
- `frontend/webapp/src/views/Read/components/ChapterContent.js` (or sibling — verify in Task 13) — surface objects in passagenotes side panel

---

## Task 1: Verify database prerequisites

**Files:** none changed.

- [ ] **Step 1: Probe the database for the new tables**

Run from the dev host:

```bash
mysql -h <remote-host> -u reader -p<read-pw> bom_prd -e "
  SELECT COUNT(*) AS objects FROM bom_objects;
  SELECT COUNT(*) AS xrels FROM bom_xrels;
  SELECT COUNT(*) AS object_index_rows FROM bom_index WHERE type='object';
"
```

Connection details are in Infisical (`bom-dev` machine identity at `~/infisical/`). The dev backend already has them loaded via `bom-load-env`; the cleanest way is to use the dev backend's loaded env:

```bash
sudo -u bom bash -c 'set -a; source $XDG_RUNTIME_DIR/bom-dev.env; set +a; mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT COUNT(*) AS objects FROM bom_objects; SELECT COUNT(*) AS xrels FROM bom_xrels; SELECT COUNT(*) AS object_index_rows FROM bom_index WHERE type=\"object\";"'
```

Expected: `objects` ≈ 198, `xrels` ≈ 1811, `object_index_rows` ≈ 2182.

If any count is zero, stop — the `00-run-all.sql` pipeline has not been applied yet. Surface this to the user; do not invent placeholder rows.

- [ ] **Step 2: Spot-check column shapes**

```bash
mysql ... -e "DESCRIBE bom_objects; DESCRIBE bom_xrels;"
```

Confirm columns match the spec (`bom_objects.guid varchar(50) PK`, `bom_xrels.uid int PK auto_increment`, `bom_xrels.\`usage\`` does NOT exist — that's only on `bom_objects`). If column types diverge from the spec, surface and stop.

- [ ] **Step 3: Commit (none — this task is a probe only)**

No files changed. Move to Task 2.

---

## Task 2: Add Sequelize model for `bom_objects`

**Files:**
- Create: `src/database/models/bom_objects.ts`

- [ ] **Step 1: Create the model file**

```typescript
import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_objects extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_objects {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        subtitle: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        category: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        specificity: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        usage: {
          type: DataTypes.STRING(20),
          allowNull: false,
          field: 'usage'
        },
        era: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        provenance: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        aliases: {
          type: DataTypes.STRING(500),
          allowNull: true
        },
        tags: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_objects',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "guid" },
          ]
        },
        {
          name: "slug",
          unique: true,
          using: "BTREE",
          fields: [{ name: "slug" }]
        }
      ]
    });
    return this;
  }
}
```

Note: `usage` is a MySQL reserved word. Sequelize handles it correctly because we specify `field: 'usage'` and `tableName` separately — Sequelize backtick-quotes column names in generated SQL. Verify by running the smoke probe below.

- [ ] **Step 2: Smoke probe — verify the model loads without TypeScript error**

```bash
cd /home/bom/BookofMormonOnline
npx tsc --noEmit src/database/models/bom_objects.ts
```

Expected: no output (success). If errors mention `ModelBase` resolution, the path is correct — `tsc` may need the full project context; run `npm run dev:backend -- --check-only` instead, or just rely on Task 3's wire-up step which restarts the backend and surfaces compile errors via `journalctl`.

- [ ] **Step 3: Commit**

```bash
git add src/database/models/bom_objects.ts
git commit -m "feat(objects): add bom_objects Sequelize model"
```

---

## Task 3: Add Sequelize model for `bom_xrels`

**Files:**
- Create: `src/database/models/bom_xrels.ts`

- [ ] **Step 1: Create the model file**

```typescript
import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xrels extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xrels {
    this.init(
      {
        uid: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        src_type: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        src_slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        rel: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        srcweight: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 50
        },
        dst_type: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        dst_slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        note: {
          type: DataTypes.STRING(500),
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_xrels',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "uid" }]
        },
        {
          name: "src",
          using: "BTREE",
          fields: [{ name: "src_type" }, { name: "src_slug" }]
        },
        {
          name: "dst",
          using: "BTREE",
          fields: [{ name: "dst_type" }, { name: "dst_slug" }]
        },
        {
          name: "rel",
          using: "BTREE",
          fields: [{ name: "rel" }]
        }
      ]
    });
    return this;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/database/models/bom_xrels.ts
git commit -m "feat(objects): add bom_xrels Sequelize model"
```

---

## Task 4: Register both models

**Files:**
- Modify: `src/database/typings/Models.d.ts` (top of file + `Models` interface)
- Modify: `src/config/database.ts` (imports near top + `models` const)

- [ ] **Step 1: Add to `Models.d.ts`**

Add imports near the existing BomPeople/BomPlaces imports (around line 19-21):

```typescript
import BomObjects from '../models/bom_objects';
import BomXrels from '../models/bom_xrels';
```

Add to the `Models` interface, adjacent to `BomPlaces` (around line 84):

```typescript
  BomObjects: typeof BomObjects;
  BomXrels: typeof BomXrels;
```

- [ ] **Step 2: Add to `src/config/database.ts`**

Add imports near line 27 (after `BomPlaces`):

```typescript
import BomObjects from '../database/models/bom_objects';
import BomXrels from '../database/models/bom_xrels';
```

Add to the `models` const near line 223 (after `BomPlaces`):

```typescript
  BomObjects: BomObjects.initModel(sequelize),
  BomXrels: BomXrels.initModel(sequelize),
```

No association statements are added — xrels resolution is programmatic batch lookup, not Sequelize associations.

- [ ] **Step 3: Restart backend, watch for compile errors**

```bash
systemctl --user restart bom-dev
journalctl --user -u bom-dev -n 100 -f --since '30s ago'
```

Expected: backend boots, `Apollo Server ready` (or equivalent) appears within ~15s. If TypeScript errors mention the new models, fix the import/interface entry. Hit Ctrl-C to stop tailing once you see the ready message.

- [ ] **Step 4: Smoke probe — verify models are registered**

In a new terminal:

```bash
curl -s http://localhost:5005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __type(name:\"Query\") { fields { name } } }"}' | jq '.data.__type.fields[].name' | sort
```

Expected: existing field list (`person`, `place`, `maps`, etc.). The new `object` field is not yet exposed — that comes in Task 6. We're just confirming the backend boots clean with the new models registered.

- [ ] **Step 5: Commit**

```bash
git add src/database/typings/Models.d.ts src/config/database.ts
git commit -m "feat(objects): register BomObjects/BomXrels models"
```

---

## Task 5: Add `BomObjects` GraphQL typeDef

**Files:**
- Create: `src/typeDefs/BomObjects.ts`
- Modify: `src/typeDefs/index.ts`

- [ ] **Step 1: Create the typedef file**

```typescript
import { gql } from 'apollo-server-express';

export default gql`
extend type Query {
  object(slug: [String]): [Object]
}

type Object {
  guid: String
  slug: String
  name: String
  subtitle: String
  category: String
  specificity: String
  usage: String
  era: String
  provenance: String
  aliases: String
  tags: String
  description: String
  verse_id: Int
  weight: Int
  index: [Index]
  xrels: [Xrel]
}

type Xrel {
  rel: String
  srcweight: Int
  dst_type: String
  dst_slug: String
  dst_name: String
  dst_title: String
  note: String
  verse_id: Int
}
`;
```

Note: `Index` is **not** redefined here — it lives in `BomPeoplePlaces.ts:109-117` and is shared.

- [ ] **Step 2: Register in `src/typeDefs/index.ts`**

Modify the existing file (current contents shown):

```typescript
import { gql } from 'apollo-server-express';

import BomNotes from './BomNotes';
import BomPage from './BomPage';
import BomUser from './BomUser';
import BomUtils from './BomUtils';
import BomPeoplePlaces from './BomPeoplePlaces';
import BomObjects from './BomObjects';
import BomCommunity from './BomCommunity';
import BomMessenger from './BomMessenger';

const linkedSchema = gql`
  type Query {
    _: Boolean
  }
  type Mutation {
    _: Boolean
  }
  scalar JSON
`;
export default [BomNotes, BomPage, BomPeoplePlaces, BomObjects, BomUser, BomUtils, BomNotes, BomCommunity, BomMessenger, linkedSchema];
```

The change: add `import BomObjects from './BomObjects';` and add `BomObjects` to the export array immediately after `BomPeoplePlaces`. (The duplicate `BomNotes` in the array is pre-existing — do not "fix" it; that's an unrelated cleanup.)

- [ ] **Step 3: Restart backend and verify schema loads**

```bash
systemctl --user restart bom-dev
journalctl --user -u bom-dev -n 50 --since '30s ago'
```

Watch for the ready line. If you see an Apollo schema-merge error like `"Object" already defined`, the resolver-or-typedef name collides with another type — check for "Object" in other typedef files (`grep -rn 'type Object' src/typeDefs/`).

- [ ] **Step 4: Smoke probe — verify `Object` type is in schema**

```bash
curl -s http://localhost:5005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __type(name:\"Object\") { fields { name type { name } } } }"}' | jq
```

Expected: returns an object with the fields `guid, slug, name, subtitle, category, ...` etc. If `data.__type` is `null`, the type isn't registered — re-check Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/typeDefs/BomObjects.ts src/typeDefs/index.ts
git commit -m "feat(objects): add BomObjects GraphQL typedef"
```

---

## Task 6: Add `BomObjects` resolver with helpers

**Files:**
- Create: `src/resolvers/BomObjects.ts`
- Modify: `src/resolvers/index.ts`

- [ ] **Step 1: Create the resolver file**

```typescript
import { models as Models } from '../config/database';
import { Op, includeTranslation, translatedValue } from './_common';
import { lookupReference } from 'scripture-guide';

const getRequestedFields = (info: any): string[] => {
  if (!info || info === true) return [];
  try {
    const fieldNode = info.fieldNodes[0];
    if (!fieldNode || !fieldNode.selectionSet) return [];
    return (fieldNode.selectionSet.selections || [])
      .filter((s: any) => s.kind === 'Field')
      .map((s: any) => s.name.value);
  } catch (e) {
    return [];
  }
};

// Parse a verse_id from an xrel note string, e.g., "Slew Amalickiah on Christmas Eve (Alma 51:34)"
// Returns null when no parseable scripture reference is found.
const parseVerseIdFromNote = (note: string | null): number | null => {
  if (!note) return null;
  // Match patterns like "Alma 51:34", "1 Nephi 16:10", "3 Ne 11:1", possibly with a verse range "Alma 32:21-23"
  const match = note.match(/\b(?:[1-4]\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:-\d+)?/);
  if (!match) return null;
  try {
    const result = lookupReference(match[0]);
    const verseIds: number[] = result?.verse_ids || [];
    if (Array.isArray(verseIds) && verseIds.length > 0) return verseIds[0];
    return null;
  } catch (e) {
    return null;
  }
};

// One-time warning per missing slug to surface data-quality issues
const warnedMissing = new Set<string>();
const warnMissing = (dst_type: string, dst_slug: string) => {
  const key = `${dst_type}:${dst_slug}`;
  if (warnedMissing.has(key)) return;
  warnedMissing.add(key);
  console.warn(`[BomObjects] xrel target missing: ${key}`);
};

export default {
  Query: {
    object: async (root: any, args: any, context: any, info: any) => {
      const where = (args.slug && args.slug.length) ? { slug: args.slug } : undefined;
      return await Models.BomObjects.findAll({
        where,
        order: [['weight', 'DESC']],
      });
    },
  },
  Object: {
    name:        (item: any) => translatedValue(item, 'name'),
    subtitle:    (item: any) => translatedValue(item, 'subtitle'),
    description: (item: any) => translatedValue(item, 'description'),
    index: async (item: any) => {
      const slug = item.getDataValue ? item.getDataValue('slug') : item.slug;
      return await Models.BomIndex.findAll({
        where: { type: 'object', slug },
        order: [['verse_id', 'ASC']],
      });
    },
    xrels: async (item: any) => {
      const slug = item.getDataValue ? item.getDataValue('slug') : item.slug;
      const rows: any[] = await Models.BomXrels.findAll({
        where: { src_type: 'object', src_slug: slug },
      });
      if (!rows.length) return [];

      const peopleSlugs: string[] = [];
      const placeSlugs: string[]  = [];
      const objectSlugs: string[] = [];
      for (const r of rows) {
        const dt = r.getDataValue('dst_type');
        const ds = r.getDataValue('dst_slug');
        if (dt === 'people') peopleSlugs.push(ds);
        else if (dt === 'place') placeSlugs.push(ds);
        else if (dt === 'object') objectSlugs.push(ds);
        // group: no lookup
      }

      const [people, places, objs] = await Promise.all([
        peopleSlugs.length ? Models.BomPeople.findAll({ where: { slug: [...new Set(peopleSlugs)] } }) : [],
        placeSlugs.length  ? Models.BomPlaces.findAll({ where: { slug: [...new Set(placeSlugs)]  } }) : [],
        objectSlugs.length ? Models.BomObjects.findAll({ where: { slug: [...new Set(objectSlugs)] } }) : [],
      ]);

      const peopleMap = new Map<string, any>(people.map((p: any) => [p.getDataValue('slug'), p]));
      const placeMap  = new Map<string, any>(places.map((p: any) => [p.getDataValue('slug'), p]));
      const objectMap = new Map<string, any>(objs.map((o: any) => [o.getDataValue('slug'), o]));

      const resolved = rows.map((r: any) => {
        const dst_type = r.getDataValue('dst_type');
        const dst_slug = r.getDataValue('dst_slug');
        const note     = r.getDataValue('note');
        let dst_name: string  = dst_slug;
        let dst_title: string | null = null;
        if (dst_type === 'people') {
          const p = peopleMap.get(dst_slug);
          if (p) { dst_name = p.getDataValue('name'); dst_title = p.getDataValue('title'); }
          else warnMissing(dst_type, dst_slug);
        } else if (dst_type === 'place') {
          const p = placeMap.get(dst_slug);
          if (p) { dst_name = p.getDataValue('name'); dst_title = p.getDataValue('info'); }
          else warnMissing(dst_type, dst_slug);
        } else if (dst_type === 'object') {
          const o = objectMap.get(dst_slug);
          if (o) { dst_name = o.getDataValue('name'); dst_title = o.getDataValue('subtitle'); }
          else warnMissing(dst_type, dst_slug);
        }
        // dst_type === 'group' falls through with dst_name = dst_slug
        return {
          rel:       r.getDataValue('rel'),
          srcweight: r.getDataValue('srcweight'),
          dst_type,
          dst_slug,
          dst_name,
          dst_title,
          note,
          verse_id:  parseVerseIdFromNote(note),
        };
      });

      // Sort: verse_id ASC NULLS LAST, srcweight ASC, dst_slug ASC
      resolved.sort((a, b) => {
        if (a.verse_id == null && b.verse_id == null) {
          // both null: fall through to srcweight
        } else if (a.verse_id == null) return 1;
        else if (b.verse_id == null) return -1;
        else if (a.verse_id !== b.verse_id) return a.verse_id - b.verse_id;
        if ((a.srcweight ?? 50) !== (b.srcweight ?? 50)) return (a.srcweight ?? 50) - (b.srcweight ?? 50);
        return a.dst_slug.localeCompare(b.dst_slug);
      });

      return resolved;
    },
  },
};

// Cross-resolver helpers (mirror BomPeoplePlace.ts:548-712)
export const loadObjectsFromTextGuid = async (guid: string, slugs: string[], lang: string) => {
  slugs = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];

  const objectSlugs = (await Models.BomLookup.findAll({
    attributes: ['text_guid'],
    where: { text_guid: guid },
    include: [{
      model: Models.BomIndex,
      as: 'bomIndexReference',
      attributes: ['slug'],
      where: { type: 'object' }
    }]
  }))?.map((item: any) => item.getDataValue('bomIndexReference').getDataValue('slug')).filter((x: any) => !!x);

  const uniqueSlugs = [...new Set([...(objectSlugs || []), ...slugs])];
  if (!uniqueSlugs.length) return [];

  const include: any[] = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'subtitle', 'description'] }, lang));
  }

  return await Models.BomObjects.findAll({
    where: { slug: uniqueSlugs },
    include: include.filter(x => !!x),
  });
};

export const loadObjectsFromVerseIds = async (verse_ids: number[], lang: string) => {
  if (!verse_ids.length) return [];

  const minVerseId = Math.min(...verse_ids);
  const maxVerseId = Math.max(...verse_ids);

  const objectSlugs = (await Models.BomIndex.findAll({
    where: {
      type: 'object',
      verse_id:     { [Op.lte]: maxVerseId },
      verse_id_end: { [Op.gte]: minVerseId },
    },
    attributes: ['slug'],
  }))?.map((item: any) => item.getDataValue('slug')).filter((x: any) => !!x);

  const uniqueSlugs = [...new Set(objectSlugs || [])];
  if (!uniqueSlugs.length) return [];

  const include: any[] = [];
  if (lang && lang !== 'en') {
    include.push(includeTranslation({ [Op.or]: ['name', 'subtitle', 'description'] }, lang));
  }

  return await Models.BomObjects.findAll({
    where: { slug: uniqueSlugs },
    include: include.filter(x => !!x),
  });
};
```

- [ ] **Step 2: Register in `src/resolvers/index.ts`**

Update the file:

```typescript
import BomNotes from './BomNotes';
import BomPage from './BomPage';
import BomUser from './BomUser';
import BomUtils from './BomUtils';
import BomCommunity from './BomCommunity';
import BomPeoplePlace from './BomPeoplePlace';
import BomObjects from './BomObjects';
import BomMessenger from './BomMessenger';

export default [BomPage, BomPeoplePlace, BomObjects, BomNotes, BomUser, BomUtils, BomCommunity, BomMessenger];
```

The change: add `import BomObjects` and add `BomObjects` to the array immediately after `BomPeoplePlace`.

- [ ] **Step 3: Restart and watch logs**

```bash
systemctl --user restart bom-dev
journalctl --user -u bom-dev -n 100 -f --since '30s ago'
```

Watch for the ready line. Apollo will throw a schema-merge error if any type is duplicated — fix and restart.

- [ ] **Step 4: Smoke probe — verify the `object` query works end-to-end**

```bash
curl -s http://localhost:5005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ object(slug:[\"liahona\"]) { slug name subtitle category era provenance index { ref verse_id text } xrels { rel dst_type dst_slug dst_name dst_title note verse_id } } }"}' | jq
```

Expected:
- `data.object[0].slug` === `"liahona"`
- `data.object[0].category` === `"sacred-object"`
- `data.object[0].index` has multiple rows (refs to 1 Ne 16:10, Alma 37:38, etc.)
- `data.object[0].xrels` contains `owned-by` → `lehi` (with `dst_name: "Lehi"` resolved), `nephi1`, `mosiah1`, etc.
- The xrels list is ordered by `verse_id` ASC (rows with parseable scripture refs in their note come first).

If `dst_name` echoes the slug rather than resolving to a real name, the target lookup logic is broken — verify the batch lookup in Step 1's `xrels` resolver.

- [ ] **Step 5: Smoke probe — verify the no-arg list query works**

```bash
curl -s http://localhost:5005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ object { slug name category weight } }"}' | jq '.data.object | length'
```

Expected: `198` (or whatever Task 1's probe returned).

- [ ] **Step 6: Commit**

```bash
git add src/resolvers/BomObjects.ts src/resolvers/index.ts
git commit -m "feat(objects): add BomObjects resolver with xrels + helpers"
```

---

## Task 7: Wire `objects` into `passagenotes`

**Files:**
- Modify: `src/typeDefs/BomNotes.ts:26-37` — add `objects: [Object]` to `PassageNotes`
- Modify: `src/resolvers/BomNotes.ts:6` — import helpers
- Modify: `src/resolvers/BomNotes.ts:331-343` — add objects to parallel load
- Modify: `src/resolvers/BomNotes.ts:367-378` — add objects to return shape

- [ ] **Step 1: Add `objects` field to `PassageNotes` type**

In `src/typeDefs/BomNotes.ts`, the `PassageNotes` block currently reads (line 26-37):

```graphql
  type PassageNotes {
    commentary: [Commentary]
    sources: [Source]
    chiasmus: [Chiasmus]
    people: [People]
    places: [Place]
    images: [Image]
    notes: [Note]
    fax: [Fax]
    mapstory: [MapStory]
    refs: [Reference]
  }
```

Add `objects: [Object]` immediately after `places`:

```graphql
  type PassageNotes {
    commentary: [Commentary]
    sources: [Source]
    chiasmus: [Chiasmus]
    people: [People]
    places: [Place]
    objects: [Object]
    images: [Image]
    notes: [Note]
    fax: [Fax]
    mapstory: [MapStory]
    refs: [Reference]
  }
```

- [ ] **Step 2: Update the import in `src/resolvers/BomNotes.ts:6`**

Change:

```typescript
import { loadPeopleFromTextGuid, loadPeopleFromVerseIds, loadPlacesFromVerseIds, loadNotesFromTextGuid } from './BomPeoplePlace';
```

to add an import from BomObjects right after:

```typescript
import { loadPeopleFromTextGuid, loadPeopleFromVerseIds, loadPlacesFromVerseIds, loadNotesFromTextGuid } from './BomPeoplePlace';
import { loadObjectsFromTextGuid, loadObjectsFromVerseIds } from './BomObjects';
```

- [ ] **Step 3: Extend the parallel-load block at `BomNotes.ts:331-343`**

The current block:

```typescript
      // Load people, places, and notes using both verse-based and text-guid-based approaches
      const [people, places, notes] = await Promise.all([
        // Load people from both verse IDs and text GUIDs
        Promise.all([
          loadPeopleFromVerseIds(verse_ids, lang),
          guids.length > 0 ? Promise.all(guids.map(guid => loadPeopleFromTextGuid(guid, [], lang))).then(results => results.flat()) : []
        ]).then(results => results.flat()),

        // Load places directly from verse IDs via BomIndex
        loadPlacesFromVerseIds(verse_ids, lang),

        // Load notes from text GUIDs
        guids.length > 0 ? Promise.all(guids.map(guid => loadNotesFromTextGuid(guid, lang))).then(results => results.flat()) : []
      ]);
```

becomes:

```typescript
      // Load people, places, objects, and notes using both verse-based and text-guid-based approaches
      const [people, places, objects, notes] = await Promise.all([
        // Load people from both verse IDs and text GUIDs
        Promise.all([
          loadPeopleFromVerseIds(verse_ids, lang),
          guids.length > 0 ? Promise.all(guids.map(guid => loadPeopleFromTextGuid(guid, [], lang))).then(results => results.flat()) : []
        ]).then(results => results.flat()),

        // Load places directly from verse IDs via BomIndex
        loadPlacesFromVerseIds(verse_ids, lang),

        // Load objects from both verse IDs and text GUIDs
        Promise.all([
          loadObjectsFromVerseIds(verse_ids, lang),
          guids.length > 0 ? Promise.all(guids.map(guid => loadObjectsFromTextGuid(guid, [], lang))).then(results => results.flat()) : []
        ]).then(results => results.flat()),

        // Load notes from text GUIDs
        guids.length > 0 ? Promise.all(guids.map(guid => loadNotesFromTextGuid(guid, lang))).then(results => results.flat()) : []
      ]);
```

- [ ] **Step 4: Add `objects` to the return at `BomNotes.ts:367-378`**

The current return:

```typescript
      return {
        commentary: commentary || [],
        sources: sources || [],
        chiasmus: Object.values(processedChiasmus) || [],
        people: people || [],
        places: places || [],
        images: images || [],
        notes: notes || [],
        fax: fax || [],
        mapstory: mapstory || [],
        refs: refs || []
      };
```

becomes:

```typescript
      return {
        commentary: commentary || [],
        sources: sources || [],
        chiasmus: Object.values(processedChiasmus) || [],
        people: people || [],
        places: places || [],
        objects: objects || [],
        images: images || [],
        notes: notes || [],
        fax: fax || [],
        mapstory: mapstory || [],
        refs: refs || []
      };
```

Also update the early-return at lines 190-203 (the empty-verse-ids branch) — add `objects: []` to that early-return shape so the empty case is consistent:

```typescript
      if (!verse_ids.length) {
        return {
          commentary: [],
          sources: [],
          chiasmus: [],
          people: [],
          places: [],
          objects: [],
          images: [],
          notes: [],
          fax: [],
          mapstory: [],
          refs: []
        };
      }
```

- [ ] **Step 5: Restart backend and watch logs**

```bash
systemctl --user restart bom-dev
journalctl --user -u bom-dev -n 50 --since '30s ago'
```

Watch for ready line. If you see TypeScript errors about destructuring (4-tuple vs prior 3-tuple), the array indices changed — verify Step 3.

- [ ] **Step 6: Smoke probe — verify passagenotes returns objects**

`Alma 51:34` (Teancum's javelin) maps to verse_id ~35691 (use `lookupReference` to confirm). Pick a verse_id you can verify against by inspecting `bom_index`. A safer hit: `1 Nephi 16:10` → verse_id `31508` (the Liahona discovery verse).

```bash
curl -s http://localhost:5005/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ passagenotes(start_verse_id:31508,end_verse_id:31508) { people { slug } places { slug } objects { slug name subtitle category } } }"}' | jq '.data.passagenotes'
```

Expected: `objects` array contains `liahona` (and possibly other objects mentioned in that verse). If `objects` is `null` or `[]` when you expect data, the integration is broken — check Step 3.

- [ ] **Step 7: Commit**

```bash
git add src/typeDefs/BomNotes.ts src/resolvers/BomNotes.ts
git commit -m "feat(objects): surface objects in passagenotes resolver"
```

---

## Task 8: Frontend — add `object`/`objectList` queries

**Files:**
- Modify: `frontend/webapp/src/models/GraphQLQueries.js`

- [ ] **Step 1: Add `object` and `objectList` after the existing `placeList` block (around line 99)**

Insert immediately after the `placeList` definition (after line 99) and before `passagenotes`:

```javascript
  object: (ids) => {
    return {
      type: "object",
      key: "slug",
      val: ids,
      query:
        q("object", "slug", ids) +
        `{
                slug
                name
                subtitle
                category
                specificity
                usage
                era
                provenance
                aliases
                tags
                description
                weight
                verse_id
                index {
                    slug
                    ref
                    verse_id
                    text
                }
                xrels {
                    rel
                    srcweight
                    dst_type
                    dst_slug
                    dst_name
                    dst_title
                    note
                    verse_id
                }
            }`,
    }
  },
  objectList: (ids) => {
    return {
      type: "objectList",
      key: "slug",
      val: ids,
      query:
        q("objectList: object", "slug", ids) +
        `{
                slug
                name
                subtitle
                category
                era
                provenance
                specificity
                usage
                weight
            }`,
    }
  },
```

- [ ] **Step 2: Extend the `passagenotes` template to request objects**

The current `passagenotes` query body (lines 105-139) requests `{ commentary, people, places, images, chiasmus, refs }`. Add an `objects` block after `places`:

```javascript
                places {
                    name
                    info
                    slug
                }
                objects {
                    slug
                    name
                    subtitle
                    category
                }
                images {
```

- [ ] **Step 3: Smoke probe — verify the frontend query template compiles**

The frontend uses Webpack HMR; the change should be picked up automatically by the running dev server. To confirm the GraphQL string is well-formed, open the browser console at `https://bom.kckern.net/` (or local dev) and run:

```javascript
import('./src/models/GraphQLQueries.js').then(m => console.log(m.default.object(['liahona']).query));
```

(If that import path resolution fails inside the running app, the simpler check is to load `/objects` later in Task 13 and watch the network tab.)

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/GraphQLQueries.js
git commit -m "feat(objects): add object/objectList GraphQL templates"
```

---

## Task 9: Frontend — extend appController preload gate

**Files:**
- Modify: `frontend/webapp/src/models/appController.js:363`
- Modify: `frontend/webapp/src/views/_Common/Main.js:95-107` (initial preload site)

- [ ] **Step 1: Update the preload gate in `appController.js`**

Current line 363:

```javascript
    if(!!input.val?.personList) appController.states.preloaded = true;
```

Change to:

```javascript
    if(!!input.val?.personList && !!input.val?.placeList && !!input.val?.objectList) appController.states.preloaded = true;
```

- [ ] **Step 2: Add `objectList` to the initial preload payload in `Main.js`**

The initial preload is in `frontend/webapp/src/views/_Common/Main.js:95-107`. Currently:

```javascript
    BoMOnlineAPI(
      {
        personList: null,
        placeList: null,
        divisionShell: null,
        fax: null,
        labels: null,
        tokenSignIn: localToken,
        publications: true
      },
      {
        useCache: ["personList", "placeList","publications", "divisionShell", "fax"], //,"labels"
      }
    ).then((r) => {
```

Modify to add `objectList: null` to the request object and `"objectList"` to the `useCache` array:

```javascript
    BoMOnlineAPI(
      {
        personList: null,
        placeList: null,
        objectList: null,
        divisionShell: null,
        fax: null,
        labels: null,
        tokenSignIn: localToken,
        publications: true
      },
      {
        useCache: ["personList", "placeList", "objectList", "publications", "divisionShell", "fax"], //,"labels"
      }
    ).then((r) => {
```

- [ ] **Step 3: Smoke probe — reload the page and watch Network tab**

Open the dev URL with browser DevTools → Network → filter for `graphql`. Reload. Find the initial preload request and confirm its body includes the `objectList` query. The response should include an `objectList` array of ~198 items.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/appController.js frontend/webapp/src/views/_Common/Main.js
git commit -m "feat(objects): include objectList in initial preload"
```

---

## Task 10: Frontend — create `objectsFilterData.js`

**Files:**
- Create: `frontend/webapp/src/views/Objects/objectsFilterData.js`

- [ ] **Step 1: Create the file**

```javascript
// Five filter axes for the Objects index. Each axis exports a list of chips
// with { key, label, tag } where `key` is the i18n label key, `label` is the
// English fallback, and `tag` is the canonical value stored in bom_objects.

export const categoryChips = [
  { key: "object_cat_animal",       label: "Animal",        tag: "animal" },
  { key: "object_cat_building",     label: "Building",      tag: "building" },
  { key: "object_cat_weapon",       label: "Weapon",        tag: "weapon" },
  { key: "object_cat_food",         label: "Food",          tag: "food" },
  { key: "object_cat_sacred_object",label: "Sacred Object", tag: "sacred-object" },
  { key: "object_cat_money",        label: "Money",         tag: "money" },
  { key: "object_cat_plant",        label: "Plant",         tag: "plant" },
  { key: "object_cat_record",       label: "Record",        tag: "record" },
  { key: "object_cat_metal",        label: "Metal",         tag: "metal" },
  { key: "object_cat_tool",         label: "Tool",          tag: "tool" },
  { key: "object_cat_apparel",      label: "Apparel",       tag: "apparel" },
  { key: "object_cat_structure",    label: "Structure",     tag: "structure" },
  { key: "object_cat_vehicle",      label: "Vehicle",       tag: "vehicle" },
  { key: "object_cat_landscape",    label: "Landscape",     tag: "landscape" },
  { key: "object_cat_armor",        label: "Armor",         tag: "armor" },
  { key: "object_cat_treasure",     label: "Treasure",      tag: "treasure" },
];

export const eraChips = [
  { key: "era_timeless",         label: "Timeless",         tag: "timeless" },
  { key: "era_nephite",          label: "Nephite",          tag: "nephite" },
  { key: "era_old_world",        label: "Old World",        tag: "old-world" },
  { key: "era_lehite_departure", label: "Lehite Departure", tag: "lehite-departure" },
  { key: "era_jaredite",         label: "Jaredite",         tag: "jaredite" },
  { key: "era_christ_era",       label: "Christ Era",       tag: "christ-era" },
  { key: "era_post_christ",      label: "Post-Christ",      tag: "post-christ" },
];

export const provenanceChips = [
  { key: "prov_generic",   label: "Generic",   tag: "generic" },
  { key: "prov_nephite",   label: "Nephite",   tag: "nephite" },
  { key: "prov_israelite", label: "Israelite", tag: "israelite" },
  { key: "prov_divine",    label: "Divine",    tag: "divine" },
  { key: "prov_lehite",    label: "Lehite",    tag: "lehite" },
  { key: "prov_jaredite",  label: "Jaredite",  tag: "jaredite" },
  { key: "prov_lamanite",  label: "Lamanite",  tag: "lamanite" },
  { key: "prov_mulekite",  label: "Mulekite",  tag: "mulekite" },
];

export const specificityChips = [
  { key: "spec_specific", label: "Named",   tag: "specific" },
  { key: "spec_general",  label: "Generic", tag: "general"  },
];

export const usageChips = [
  { key: "usage_literal",       label: "Literal",     tag: "literal" },
  { key: "usage_mixed",         label: "Mixed",       tag: "mixed" },
  { key: "usage_metaphorical",  label: "Symbolic",    tag: "metaphorical" },
];

export const filterAxes = [
  { name: "category",    title: "object_axis_category",    chips: categoryChips,    titleEn: "Category" },
  { name: "era",         title: "object_axis_era",         chips: eraChips,         titleEn: "Era" },
  { name: "provenance",  title: "object_axis_provenance",  chips: provenanceChips,  titleEn: "Provenance" },
  { name: "specificity", title: "object_axis_specificity", chips: specificityChips, titleEn: "Specificity" },
  { name: "usage",       title: "object_axis_usage",       chips: usageChips,       titleEn: "Usage" },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/webapp/src/views/Objects/objectsFilterData.js
git commit -m "feat(objects): add objectsFilterData (5 axes)"
```

---

## Task 11: Frontend — add category SVG placeholder icons

**Files:**
- Create: `frontend/webapp/src/views/Objects/svg/{animal,building,weapon,food,sacred-object,money,plant,record,metal,tool,apparel,structure,vehicle,landscape,armor,treasure}.svg` (16 files)

These are placeholder geometric icons; design polish can come later. The goal is to have *something* render for the category badge / image fallback before the Midjourney pipeline lands.

- [ ] **Step 1: Generate a generic placeholder SVG template**

The simplest placeholder is a labeled circle. Create one base SVG and copy 16 times with the label changed.

For each category, create `svg/<category>.svg` with content like:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="11" fill="#888" />
  <text x="12" y="16" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">A</text>
</svg>
```

Use the first letter of the category for the label: `animal` → `A`, `building` → `B`, `weapon` → `W` (use `W` for weapon and `M` for money to disambiguate), etc. Suggested per-category accents:

| category | letter | fill |
|---|---|---|
| animal | A | #8B6F3A |
| building | B | #6B6B6B |
| weapon | W | #8B2A2A |
| food | F | #C58A3A |
| sacred-object | S | #9B6BAF |
| money | M | #C7A540 |
| plant | P | #4D7A2A |
| record | R | #6B4A2A |
| metal | T | #5B5B5B |
| tool | L | #3A6A6A |
| apparel | C | #6A3A6A |
| structure | U | #5B6A3A |
| vehicle | V | #2A4A6A |
| landscape | N | #4A6A3A |
| armor | O | #3A3A3A |
| treasure | X | #B8860B |

(Letter assignments avoid duplication so the placeholders are distinguishable at small sizes.)

- [ ] **Step 2: Quick bash one-liner to generate all 16**

```bash
mkdir -p /home/bom/BookofMormonOnline/frontend/webapp/src/views/Objects/svg
cd /home/bom/BookofMormonOnline/frontend/webapp/src/views/Objects/svg
while IFS=, read -r name letter fill; do
  cat > "${name}.svg" <<SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="11" fill="${fill}" />
  <text x="12" y="16" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${letter}</text>
</svg>
SVGEOF
done <<DATA
animal,A,#8B6F3A
building,B,#6B6B6B
weapon,W,#8B2A2A
food,F,#C58A3A
sacred-object,S,#9B6BAF
money,M,#C7A540
plant,P,#4D7A2A
record,R,#6B4A2A
metal,T,#5B5B5B
tool,L,#3A6A6A
apparel,C,#6A3A6A
structure,U,#5B6A3A
vehicle,V,#2A4A6A
landscape,N,#4A6A3A
armor,O,#3A3A3A
treasure,X,#B8860B
DATA
ls -1 | sort
```

Expected output: 16 file names, sorted.

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Objects/svg/
git commit -m "feat(objects): add category icon placeholders"
```

---

## Task 12: Frontend — create `Objects.js` view

**Files:**
- Create: `frontend/webapp/src/views/Objects/Objects.js`
- Create: `frontend/webapp/src/views/Objects/Objects.css`

- [ ] **Step 1: Create `Objects.css`**

Minimal stylesheet — just the bits that differ from `Places.css`. Import `../Places/Places.css` and `../People/People.css` for the masonry baseline.

```css
/* Objects view — mirrors Places.css with object-specific tweaks */

.ObjectList .card .objectInfo {
  min-height: 8em;
  background-size: cover;
  background-position: center;
  position: relative;
}

.ObjectList .card .subtitle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5em;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  color: white;
  font-size: 0.85em;
  line-height: 1.3;
}

.ObjectList .card .CategoryBadge {
  display: inline-block;
  padding: 0.15em 0.5em;
  margin-right: 0.25em;
  border-radius: 0.4em;
  font-size: 0.75em;
  text-transform: capitalize;
  background: rgba(0,0,0,0.1);
}

.ObjectList .card .EraBadge {
  display: inline-block;
  padding: 0.15em 0.5em;
  border-radius: 0.4em;
  font-size: 0.75em;
  background: rgba(0,0,0,0.05);
  color: #666;
  text-transform: capitalize;
}

.ObjectList .card .SpecificityBadge {
  display: inline-block;
  margin-left: 0.25em;
  padding: 0.1em 0.4em;
  font-size: 0.7em;
  border: 1px solid #999;
  border-radius: 0.3em;
  color: #555;
}

.ObjectEmptyState {
  text-align: center;
  padding: 4em 2em;
  color: #888;
}
```

- [ ] **Step 2: Create `Objects.js`**

```javascript
/** @format */

import React, { useState, useEffect } from "react";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { Spinner } from "../_Common/Loader";
import Masonry from "react-masonry-css";
import { isMobile, label, processName, replaceNumbers } from "src/models/Utils";
import { Link, useRouteMatch } from "react-router-dom";
import { Card, CardHeader, CardBody, CardFooter, Button } from "reactstrap";
import "./Objects.css";
import "../Places/Places.css";
import "../People/People.css";

import { ObjectsFilter } from "./ObjectsFilter";
import { categoryChips } from "./objectsFilterData";

// Eager import of all 16 category SVGs so webpack bundles them.
import animal       from "./svg/animal.svg";
import building     from "./svg/building.svg";
import weapon       from "./svg/weapon.svg";
import food         from "./svg/food.svg";
import sacredObject from "./svg/sacred-object.svg";
import money        from "./svg/money.svg";
import plant        from "./svg/plant.svg";
import record_      from "./svg/record.svg";
import metal        from "./svg/metal.svg";
import tool         from "./svg/tool.svg";
import apparel      from "./svg/apparel.svg";
import structure    from "./svg/structure.svg";
import vehicle      from "./svg/vehicle.svg";
import landscape    from "./svg/landscape.svg";
import armor        from "./svg/armor.svg";
import treasure     from "./svg/treasure.svg";

const categoryIcon = {
  "animal": animal,
  "building": building,
  "weapon": weapon,
  "food": food,
  "sacred-object": sacredObject,
  "money": money,
  "plant": plant,
  "record": record_,
  "metal": metal,
  "tool": tool,
  "apparel": apparel,
  "structure": structure,
  "vehicle": vehicle,
  "landscape": landscape,
  "armor": armor,
  "treasure": treasure,
};

function ObjectsComponent({ appController }) {
  useEffect(() => {
    document.title = label("menu_objects") + " | " + label("home_title");
  }, []);

  const [objectList, setObjectList] = useState(appController.preLoad?.objectList || null);

  const emptyFilters = { category: new Set(), era: new Set(), provenance: new Set(), specificity: new Set(), usage: new Set(), search: null };
  const [objectFilters, setFilter] = useState(emptyFilters);

  const match = useRouteMatch();
  useEffect(() => {
    if (match?.params?.objectSlug) {
      appController.functions.setPopUp({
        type: "object",
        ids: [match.params.objectSlug],
        underSlug: "objects",
      });
    }
  }, [match?.params?.objectSlug]);

  useEffect(() => {
    if (!objectList) {
      BoMOnlineAPI({ objectList: true }).then((result) => {
        setObjectList(result.objectList);
      });
    }
  }, [objectList]);

  const breakpointColumnsObj = {
    default: 8, 1600: 7, 1400: 6, 1200: 5, 1000: 4, 800: 3, 600: 2, 400: 2,
  };

  const handleClick = (slug, e) => {
    e.preventDefault();
    appController.functions.setPopUp({
      type: "object",
      ids: [slug],
      underSlug: "objects",
    });
  };

  // AND across axes; OR within an axis. Empty set on an axis = no filter on that axis.
  const passesFilters = (item) => {
    if (objectFilters.search) {
      const re = new RegExp(objectFilters.search, "gi");
      if (!re.test(item.name) && !re.test(item.subtitle || "")) return false;
    }
    for (const axis of ["category", "era", "provenance", "specificity", "usage"]) {
      const set = objectFilters[axis];
      if (set && set.size > 0 && !set.has(item[axis])) return false;
    }
    return true;
  };

  const swapToFallback = (e, cat) => {
    if (e.target.dataset.fallback === "1") return;
    e.target.dataset.fallback = "1";
    e.target.src = categoryIcon[cat] || categoryIcon["sacred-object"];
    e.target.classList.add("category-fallback");
  };

  if (!objectList) {
    return (
      <div className="container noselect" style={{ display: "block" }}>
        <Spinner top={isMobile() ? "50vh" : "60vh"} />
      </div>
    );
  }

  const filtered = objectList.filter(passesFilters).filter(o => o.slug);

  return (
    <div className="container noselect" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">{label("title_objects")}</h3>
        <ObjectsFilter
          appController={appController}
          objectFilters={objectFilters}
          setFilter={setFilter}
          objectList={objectList}
        />
        <div className="ObjectList">
          {filtered.length === 0 ? (
            <div className="ObjectEmptyState">
              {label("no_objects_match")}{" "}
              <Button color="link" onClick={() => setFilter(emptyFilters)}>
                {label("clear_filters")}
              </Button>
            </div>
          ) : (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {filtered.map((obj, i) => (
                <Link
                  key={i}
                  to={"/objects/" + obj.slug}
                  onClick={(e) => handleClick(obj.slug, e)}
                >
                  <Card>
                    <CardHeader className="text-center">
                      <h5>{processName(obj.name)}</h5>
                    </CardHeader>
                    <CardBody
                      className="objectInfo"
                      style={{
                        backgroundImage: `url(${assetUrl}/objects/${obj.slug})`,
                      }}
                    >
                      <img
                        alt=""
                        src={`${assetUrl}/objects/${obj.slug}`}
                        style={{ display: "none" }}
                        onError={(e) => swapToFallback(e, obj.category)}
                      />
                      {obj.subtitle && (
                        <div className="subtitle">{replaceNumbers(obj.subtitle)}</div>
                      )}
                    </CardBody>
                    <CardFooter className="text-center">
                      <span className={"CategoryBadge cat-" + obj.category}>
                        {obj.category}
                      </span>
                      <span className={"EraBadge era-" + obj.era}>{obj.era}</span>
                      {obj.specificity === "specific" && (
                        <span className="SpecificityBadge">{label("spec_specific") || "Named"}</span>
                      )}
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </Masonry>
          )}
        </div>
      </div>
    </div>
  );
}

export default ObjectsComponent;
```

Note on `category` fallback when the slug-asset is missing: the `<CardBody style={{backgroundImage}}>` will silently fail without firing `onError`. The hidden `<img>` next to it triggers the load attempt and lets us detect the 404 via `onError`. When it fails, we swap its `src` to the category icon and add a class — separately, the CSS for `.objectInfo:has(.category-fallback)` should set `background: #f0f0f0` to make the fallback visible. (Adding `:has` support is optional polish; the swap itself works without it because the badge in the footer still identifies the category.)

- [ ] **Step 3: Smoke probe — navigate to `/objects`**

After HMR reloads, browser → `/objects`. Expected:
- 198 cards render in a masonry grid.
- Each card shows name, subtitle, category badge, era badge.
- Clicking a card opens an Object popup (will be a `null` render until Task 14 wires PopUp.js — for now, just verify the click doesn't navigate elsewhere and the URL updates to `/objects/<slug>`).

If the page is blank, check the browser console for module-not-found on the SVG imports (Task 11 must be complete).

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Objects/Objects.js frontend/webapp/src/views/Objects/Objects.css
git commit -m "feat(objects): add Objects index view"
```

---

## Task 13: Frontend — create `ObjectsFilter.js`

**Files:**
- Create: `frontend/webapp/src/views/Objects/ObjectsFilter.js`

- [ ] **Step 1: Create the file**

```javascript
/** @format */

import React, { useEffect, useState } from "react";
import { Button } from "reactstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { isMobile, label } from "src/models/Utils";
import { SearchPopUp } from "../_Common/SearchPopUp";
import { filterAxes } from "./objectsFilterData";

export function ObjectsFilter({ appController, objectFilters, setFilter, objectList }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initSearchString, setInitSearchString] = useState("");

  const toggleChip = (axis, tag) => {
    const next = { ...objectFilters };
    const set = new Set(next[axis]);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    next[axis] = set;
    setFilter(next);
  };

  const setAxis = (axis, all) => {
    const next = { ...objectFilters };
    next[axis] = all
      ? new Set(filterAxes.find((a) => a.name === axis).chips.map((c) => c.tag))
      : new Set();
    setFilter(next);
  };

  const renderAxis = (axis) => (
    <ul key={axis.name}>
      <li className="lihead">{label(axis.title) || axis.titleEn}</li>
      <li className="lifoot">
        <Button onClick={() => setAxis(axis.name, true)}>{label("select_all")}</Button>
        <Button onClick={() => setAxis(axis.name, false)}>{label("clear")}</Button>
      </li>
      {axis.chips.map((chip, idx) => (
        <li key={idx} className="item" onClick={() => toggleChip(axis.name, chip.tag)}>
          <BootstrapSwitchButton
            checked={objectFilters[axis.name].has(chip.tag)}
            onstyle="success"
            offlabel={label("off")}
            onlabel={label("on")}
            size="xs"
          />
          {label(chip.key) || chip.label}
        </li>
      ))}
    </ul>
  );

  const selectItemHandler = (slug) => {
    appController.functions.setPopUp({
      type: "object",
      ids: [slug],
      underSlug: "objects",
    });
    setIsOpen(false);
  };

  const filterBox = (
    <>
      <h5 className="ppFiltersHeading">{label("selectors")}</h5>
      <div className="ppFilters">
        {!isMobile() && (
          <button className="ppFiltersSearchButton" onClick={() => setIsOpen(true)}>
            🔍
          </button>
        )}
        <div className="ppColumns">{filterAxes.map(renderAxis)}</div>
        {!isMobile() && (
          <SearchPopUp
            placeholder="search_for_an_object"
            preLoadData={objectList}
            selectItemHandler={selectItemHandler}
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            testFieldNames={{ primary: "name", secondary: "subtitle" }}
            assetName="objects"
            initSearchString={initSearchString}
          />
        )}
      </div>
    </>
  );

  const handleClick = () => {
    appController.functions.setPopUp({
      type: "oFilter",
      ids: [appController.states.user.social?.user_id],
      underSlug: "objects",
      popUpData: { filterBox, setFilter, objectFilters },
    });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const ignoreKeys = ["-", "_", "=", "+", "[", "]", "Tab", "\\", "/", "|"];
      if (document.activeElement.tagName !== "INPUT" && ignoreKeys.includes(event.key)) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Escape") setIsOpen(false);
      if (document.activeElement.tagName === "INPUT") { event.stopPropagation(); return; }
      if (event.key.length > 1) return;
      setIsOpen(true);
      setInitSearchString(event.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isMobile()) {
    return (
      <div className="filterDrawerButton">
        <Button onClick={handleClick}>{label("selectors")}</Button>
        <button className="ppFiltersSearchButtonMobile" onClick={() => setIsOpen(true)}>🔍</button>
        <SearchPopUp
          placeholder="search_for_an_object"
          preLoadData={objectList}
          selectItemHandler={selectItemHandler}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          testFieldNames={{ primary: "name", secondary: "subtitle" }}
          assetName="objects"
          initSearchString={initSearchString}
        />
      </div>
    );
  }

  return filterBox;
}
```

- [ ] **Step 2: Smoke probe**

Reload `/objects`. Expected:
- Filter sidebar (or drawer on mobile) renders with 5 sections: Category, Era, Provenance, Specificity, Usage.
- Each section has chips; toggling a chip narrows the visible cards.
- Search popup opens on `🔍` click; typing in it surfaces matching objects.

If the page crashes with `objectFilters[axis.name].has is not a function`, that's a state-shape mismatch — make sure `Objects.js`'s initial state uses `new Set()` per axis (Task 12 Step 2 already does this).

- [ ] **Step 3: Commit**

```bash
git add frontend/webapp/src/views/Objects/ObjectsFilter.js
git commit -m "feat(objects): add ObjectsFilter (5-axis chips)"
```

---

## Task 14: Frontend — add `Object` component to `PopUp.js`

**Files:**
- Modify: `frontend/webapp/src/views/_Common/PopUp.js`

- [ ] **Step 1: Add the dispatch branch**

After the `Place` dispatch branch (around line 105-109 in `PopUp.js`), add an `Object` branch:

```javascript
  if (appController.states.popUp.type === "people")
    return <Person appController={appController} />;
  if (
    appController.states.popUp.type === "places" ||
    appController.states.popUp.type === "place"
  )
    return <Place appController={appController} />;
  if (appController.states.popUp.type === "object")
    return <ObjectPopUp appController={appController} />;
```

- [ ] **Step 2: Add the `ObjectPopUp` component**

After the `Place` function definition (which ends around line 360+ — search for `function Place(` and add after its closing brace), append a new `ObjectPopUp` function:

```javascript
function ObjectPopUp({ appController }) {
  const [PopUpRef, setPopUpRef] = useState(null);
  const activeId = appController.states.popUp.activeId;

  if (appController.popUpData[activeId] === undefined) {
    BoMOnlineAPI(
      { object: appController.states.popUp.ids },
      { useCache: ["object"] }
    ).then((response) => {
      appController.functions.setPopUp({
        type: "object",
        ids: appController.states.popUp.ids,
        popUpData: response.object,
      });
      if (!response.object) return false;
      const obj = response.object[activeId];
      // Pre-fetch any sibling objects referenced in xrels for snappy swap-click
      const siblingObjectSlugs = (obj?.xrels || [])
        .filter((x) => x.dst_type === "object" && x.dst_slug)
        .map((x) => x.dst_slug);
      if (siblingObjectSlugs.length) {
        BoMOnlineAPI({ object: siblingObjectSlugs }, { useCache: ["object"] });
      }
      setPopUpRef(null);
    });
    return <Loading type="Object" appController={appController} />;
  }

  const obj = appController.popUpData[activeId];
  if (!obj) return <pre>{appController.popUp}</pre>;

  const handleXrelClick = (xrel, e) => {
    e.preventDefault();
    if (xrel.dst_type === "people") {
      appController.functions.setPopUp({ type: "people", ids: [xrel.dst_slug], underSlug: "people" });
    } else if (xrel.dst_type === "place") {
      appController.functions.setPopUp({ type: "places", ids: [xrel.dst_slug], underSlug: "places" });
    } else if (xrel.dst_type === "object") {
      appController.functions.setPopUp({ type: "object", ids: [xrel.dst_slug], underSlug: "objects" });
    }
    // group: non-clickable, no-op
  };

  return (
    <Draggable handle=".card-header">
      <div
        id="popUp"
        className="card pp popupwindow"
        style={{
          top: appController.states.popUp.top,
          left: appController.states.popUp.left,
        }}
      >
        <div className="card-header">
          <div className="person_head">{label("object_profile") || "Object"}</div>
          <ul className={"source_tabs souce_tab_list_" + appController.states.popUp.ids.length}>
            <li className="close" onClick={appController.functions.closePopUp}>
              ×
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="ppbody">
            <div className="bodytext">
              <h3>
                {processName(obj.name)}
                {obj.subtitle && (
                  <>
                    <br />
                    <small className="ppbody-title">{replaceNumbers(obj.subtitle)}</small>
                  </>
                )}
              </h3>
              {renderPersonPlaceHTML(
                detectScriptures(
                  obj.description || "",
                  (scripture) => scripture ? `<a className="scripture_link">${scripture}</a>` : "",
                  determineLanguage()
                ),
                appController,
                setPopUpRef
              )}
            </div>

            <div className="refbox">
              <div className="ppimg">
                <img
                  alt={obj.name}
                  src={`${assetUrl}/objects/${obj.slug}`}
                  onError={(e) => {
                    if (e.target.dataset.fallback === "1") return;
                    e.target.dataset.fallback = "1";
                    e.target.style.opacity = "0.5";
                  }}
                />
                <br />
              </div>

              <h4>{label("relationships")}</h4>
              {(obj.xrels && obj.xrels.length > 0) ? (
                <ul className="xrels">
                  {obj.xrels.map((x, idx) => {
                    const clickable = ["people", "place", "object"].includes(x.dst_type);
                    return (
                      <li key={idx} className={"xrel xrel-" + x.dst_type + (clickable ? " clickable" : "")}>
                        <span className="rel-verb">{x.rel}</span>
                        <a href="#" onClick={clickable ? (e) => handleXrelClick(x, e) : (e) => e.preventDefault()}>
                          {x.dst_name}
                          {x.dst_title && <em> ({x.dst_title})</em>}
                        </a>
                        {x.note && <div className="xrel-note">{x.note}</div>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="xrels-empty">{label("no_relationships") || "No relationships."}</p>
              )}

              <ReferenceList
                index={obj.index}
                setPopupRef={setPopUpRef}
                appController={appController}
              />
            </div>
          </div>
        </div>
        <ScripturePanelSingle scriptureData={{ ref: PopUpRef }} closeButton={true} setPopUpRef={setPopUpRef} />
        <Comments />
      </div>
    </Draggable>
  );
}
```

Note: `ReferenceList` is the same component used by Person and Place popups — it's already imported in `PopUp.js`. Same for `Comments`, `Loading`, `ScripturePanelSingle`, `Draggable`, `detectScriptures`, `renderPersonPlaceHTML`, `replaceNumbers`, `processName`, `label`, `assetUrl`, `determineLanguage`, `BoMOnlineAPI`. Verify these imports are at the top of `PopUp.js` — they should be from prior People/Place wiring. Don't add duplicates.

- [ ] **Step 3: Add minimal CSS for the xrels list to `PopUp.css`** (in `frontend/webapp/src/views/_Common/PopUp.css`)

Append at the end:

```css
.xrels {
  list-style: none;
  padding: 0;
  margin: 0.5em 0;
  max-height: 18em;
  overflow-y: auto;
}

.xrels .xrel {
  padding: 0.35em 0.5em;
  border-bottom: 1px solid #eee;
  font-size: 0.9em;
}

.xrels .xrel .rel-verb {
  display: inline-block;
  min-width: 7em;
  padding: 0.1em 0.4em;
  margin-right: 0.5em;
  font-size: 0.75em;
  color: #666;
  background: #f4f4f4;
  border-radius: 0.3em;
  text-transform: capitalize;
}

.xrels .xrel a {
  color: #333;
}

.xrels .xrel.clickable a {
  color: #0066aa;
  cursor: pointer;
}

.xrels .xrel.xrel-group a {
  color: #999;
  cursor: default;
}

.xrels .xrel .xrel-note {
  font-size: 0.8em;
  color: #888;
  margin-top: 0.15em;
  margin-left: 7.5em;
}
```

- [ ] **Step 4: Smoke probe — open an object popup**

Browser → `/objects/liahona`. Expected:
- Popup opens with "Liahona" header, subtitle, description with inline scripture links.
- Right pane: image (or fallback), Relationships list with `owned-by Lehi`, `owned-by Nephi`, `taught-by Alma2`, etc.
- Clicking `Lehi` swaps the popup to Lehi's Person view.
- Clicking the close `×` dismisses the popup.

If the Relationships list is empty, the GraphQL response is missing `xrels` — check the backend probe from Task 6.

- [ ] **Step 5: Commit**

```bash
git add frontend/webapp/src/views/_Common/PopUp.js frontend/webapp/src/views/_Common/PopUp.css
git commit -m "feat(objects): add Object popup branch with xrels panel"
```

---

## Task 15: Frontend — register routes

**Files:**
- Modify: `frontend/webapp/src/models/Routes.js`

- [ ] **Step 1: Add lazy import**

Around line 17-20 (where `People`, `Places` are imported), add:

```javascript
const Objects = lazy(() => import("../views/Objects/Objects.js"));
```

- [ ] **Step 2: Add routes**

Around line 200-210 (after the `/places` block), add:

```javascript
  {
    path: "/objects/:objectSlug",
    component: Objects,
  },
  {
    path: "/objects",
    component: Objects,
  },
```

Order matters in `react-router-dom` v5 with `<Switch>` — the parameterized path must come **before** the bare `/objects` path. (This is the same pattern as `/places/:placeName` → `/places`.)

- [ ] **Step 3: Smoke probe — verify routing**

Browser → reload. Navigate to `/objects` → list renders. Navigate to `/objects/sword-of-laban` → popup opens with sword-of-laban detail. Back/forward browser buttons should work cleanly.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/models/Routes.js
git commit -m "feat(objects): register /objects routes"
```

---

## Task 16: Frontend — surface objects in Reader passagenotes side panel

**Files:**
- Create: `frontend/webapp/src/views/Read/CategoryPanels/ObjectsPanel.js`
- Modify: `frontend/webapp/src/views/Read/PassageNotes.js`

The consumer is `views/Read/PassageNotes.js`. It maintains category tabs (Commentary/People/Places/Images/Chiasmus/Refs) and lazy-renders a `BasePanel` per tab. Category panels currently `JSON.stringify` their data as placeholder content — we match that bar.

- [ ] **Step 1: Create `ObjectsPanel.js`**

Path: `frontend/webapp/src/views/Read/CategoryPanels/ObjectsPanel.js`

```javascript
import React from 'react';

const ObjectsPanel = ({ data }) => {
    return (
        <pre className="category-data">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
};

export default ObjectsPanel;
```

This matches `PlacesPanel.js` / `PeoplePanel.js` exactly — same placeholder rendering. Polish (proper card UI, click-to-popup) is a follow-up PR; this PR's job is parity with the existing surface, not extending it.

- [ ] **Step 2: Wire `ObjectsPanel` into `PassageNotes.js`**

Make four edits in `frontend/webapp/src/views/Read/PassageNotes.js`:

**Edit 1** (after line 5):

```javascript
import PlacesPanel from './CategoryPanels/PlacesPanel';
import ObjectsPanel from './CategoryPanels/ObjectsPanel';
```

**Edit 2** (in `counts` initial object at lines 22-29):

```javascript
        const counts = {
            commentary: [],
            people: [],
            places: [],
            objects: [],
            images: [],
            chiasmus: [],
            refs: []
        };
```

**Edit 3** (in the forEach at lines 32-39):

```javascript
        Object.values(passageNotes).forEach(verseData => {
            if (verseData.commentary) counts.commentary.push(...verseData.commentary);
            if (verseData.people) counts.people.push(...verseData.people);
            if (verseData.places) counts.places.push(...verseData.places);
            if (verseData.objects) counts.objects.push(...verseData.objects);
            if (verseData.images) counts.images.push(...verseData.images);
            if (verseData.chiasmus) counts.chiasmus.push(...verseData.chiasmus);
            if (verseData.refs) counts.refs.push(...verseData.refs);
        });
```

**Edit 4** (in `panelConfig` at lines 56-63 — add an `objects` entry):

```javascript
        const panelConfig = {
            commentary: { title: 'Commentary', Component: CommentaryPanel },
            people: { title: 'People', Component: PeoplePanel },
            places: { title: 'Places', Component: PlacesPanel },
            objects: { title: 'Objects', Component: ObjectsPanel },
            images: { title: 'Images', Component: ImagesPanel },
            chiasmus: { title: 'Chiasmus', Component: ChiasmusPanel },
            refs: { title: 'References', Component: ReferencesPanel },
        };
```

**Edit 5** (add a category tab — insert after the Places tab block at lines 111-119):

```javascript
                        {categoryCounts.places && categoryCounts.places.length > 0 && (
                            <div
                                className={`category-tab ${activePanel === 'places' ? 'active' : ''}`}
                                onClick={() => handleTabClick('places')}
                            >
                                <span className="count">{categoryCounts.places.length}</span>
                                <span className="label">Places</span>
                            </div>
                        )}
                        {categoryCounts.objects && categoryCounts.objects.length > 0 && (
                            <div
                                className={`category-tab ${activePanel === 'objects' ? 'active' : ''}`}
                                onClick={() => handleTabClick('objects')}
                            >
                                <span className="count">{categoryCounts.objects.length}</span>
                                <span className="label">Objects</span>
                            </div>
                        )}
```

- [ ] **Step 3: Smoke probe**

Navigate to `/read/1-ne-16` (Liahona discovery chapter). Expected:
- Section footer tabs include `Commentary | People | Places | Objects | Images | Chiasmus | References` (showing only those with non-zero count).
- The Objects tab has a count badge indicating ~1+ entry.
- Clicking the Objects tab opens a panel showing the JSON-dumped object data (matches the visual fidelity of the other panels — they're all placeholders).
- Object names like `liahona` appear in the JSON.

If the Objects tab never appears, the backend `passagenotes.objects` array is empty — re-verify Task 7's smoke probe.

- [ ] **Step 4: Commit**

```bash
git add frontend/webapp/src/views/Read/CategoryPanels/ObjectsPanel.js frontend/webapp/src/views/Read/PassageNotes.js
git commit -m "feat(objects): surface objects tab in Reader passagenotes"
```

---

## Task 17: End-to-end smoke + final commit

**Files:** none changed; this task verifies the full feature works.

- [ ] **Step 1: Run the full manual smoke sequence**

In a browser at the dev URL:

1. Navigate to `/objects` — 198 cards render in masonry grid; filter sidebar shows 5 axes.
2. Toggle `category: weapon` chip — grid filters to ~16 cards (sword, bow, dagger, etc.).
3. Add `era: nephite` — grid narrows further. Toggle off `weapon` — only era filter active, more cards visible.
4. Clear all filters — back to 198.
5. Click the search icon, type `lia` — `Liahona` and `Liahona` (possibly variants) surface in the dropdown.
6. Click `Liahona` from search — popup opens with description, image (or category fallback), Relationships list ordered by verse_id ASC, References list ordered by verse_id ASC.
7. In the popup, click `Lehi` in the xrels list — popup swaps to Lehi's Person view; sidebar shows Lehi's profile.
8. Press Esc — popup closes.
9. Direct-navigate `/objects/sword-of-laban` — popup opens with Nephi/Benjamin1 wielding entries.
10. Direct-navigate `/read/1-ne-16/10` — Reader loads, side panel shows Objects section including Liahona alongside People and Places.

- [ ] **Step 2: Check backend log for warnings**

```bash
journalctl --user -u bom-dev -n 200 --since '10m ago' | grep "BomObjects"
```

Expected: zero or low number of "xrel target missing" warnings. Each unique missing slug warns once. If you see many warnings, the slug-target join logic might be too strict — verify Task 6.

- [ ] **Step 3: Lighthouse-style sanity check (optional)**

In the browser DevTools Performance tab, record the `/objects` page load. Total JS should not exceed ~5MB (the masonry library + reactstrap dominate; SVG icons are tiny). If significantly larger, an accidental eager-import of a heavy module slipped in — check `Objects.js` imports.

- [ ] **Step 4: Final commit (only if Steps 1-3 surface a fix)**

If anything in the smoke needed a quick fix, commit it now. Otherwise this task has no commit.

- [ ] **Step 5: Open a PR**

```bash
gh pr create --title "feat: Objects view + resolver + passagenotes integration" --body "$(cat <<'EOF'
## Summary
- New \`/objects\` index view with 5-axis filter (category/era/provenance/specificity/usage)
- New \`Object\` popup with xrels relationship list (sorted by verse_id ASC)
- New \`object\` and \`objectList\` GraphQL queries; \`passagenotes\` now surfaces objects alongside people/places
- New Sequelize models for \`bom_objects\` and \`bom_xrels\`

## Test plan
- [ ] /objects renders 198 cards; filters narrow correctly
- [ ] /objects/liahona popup shows xrels ordered chronologically
- [ ] Clicking an xrel target swaps to that entity's popup
- [ ] Reader passagenotes side panel shows Objects section
- [ ] Backend logs free of xrel-missing warnings

Spec: docs/specs/2026-05-12-objects-view-and-resolver.md
Plan: docs/plans/2026-05-12-objects-view-and-resolver.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.
