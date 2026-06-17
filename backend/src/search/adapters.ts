/**
 * MySQL adapters for search indexing — one loader per content type.
 *
 * Each loader queries the DB for all indexable rows and maps them to SourceRow
 * via a pure row-mapper helper. The TYPE_CONFIGS registry wires cfg + loader
 * together for use by reindexType().
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { SourceRow, TypeConfig } from './indexer.js';

// ─── Utilities ───────────────────────────────────────────────────────────────

const clean = (s: string | null | undefined): string => (s ?? '').trim();
const join = (...parts: Array<string | null | undefined>): string =>
  parts.map(clean).filter(Boolean).join(' ');

// ─── Person ──────────────────────────────────────────────────────────────────

export function personRowToSource(r: {
  slug: string;
  name: string | null;
  title: string | null;
  classification: string | null;
  identification: string | null;
}): SourceRow {
  return {
    entity_id: r.slug,
    title: clean(r.name) || r.slug,
    text: join(r.name, r.title),
    slug: `people/${r.slug}`,
    ref: null,
  };
}

export const loadPeople = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_people')
    .select(['slug', 'name', 'title', 'classification', 'identification'])
    .execute()) as Array<{ slug: string; name: string | null; title: string | null; classification: string | null; identification: string | null }>;
  return rows.map((r) => personRowToSource(r));
};

// ─── Place ───────────────────────────────────────────────────────────────────

export function placeRowToSource(r: {
  slug: string;
  name: string | null;
  aka: string | null;
}): SourceRow {
  return {
    entity_id: r.slug,
    title: clean(r.name) || r.slug,
    text: join(r.name, r.aka),
    slug: `places/${r.slug}`,
    ref: null,
  };
}

export const loadPlaces = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_places')
    .select(['slug', 'name', 'aka'])
    .execute()) as Array<{ slug: string; name: string | null; aka: string | null }>;
  return rows.map((r) => placeRowToSource(r));
};

// ─── Commentary ──────────────────────────────────────────────────────────────
// Table: bom_xtras_commentary
// Columns used: id (PK, number), title (string), text (string), verse_id (number|null)
// entity_id: String(id) — the integer PK is stable and unique
// slug: null — commentary has no dedicated URL slug; it appears in-line at a verse
// ref: verse_id coerced to string (null when null) — identifies the anchor verse

export function commentaryRowToSource(r: {
  id: number;
  title: string;
  text: string;
  verse_id: number | null;
}): SourceRow {
  return {
    entity_id: String(r.id),
    title: clean(r.title) || null,
    text: join(r.title, r.text),
    slug: null,
    ref: r.verse_id != null ? String(r.verse_id) : null,
  };
}

export const loadCommentary = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_xtras_commentary')
    .select(['id', 'title', 'text', 'verse_id'])
    .where('is_note', '!=', 1)
    .execute()) as Array<{ id: number; title: string; text: string; verse_id: number | null }>;
  return rows.map((r) => commentaryRowToSource(r));
};

// ─── Narration ───────────────────────────────────────────────────────────────
// Table: bom_narration
// Columns used: guid (PK string), description (string)
// entity_id: guid
// title: description (narrations have no separate title field)
// slug: null — narrations are structural containers; URL path comes from bom_slug join
//              which would require a more expensive query; omit for now
// ref: null — no verse anchor at the narration level

export function narrationRowToSource(r: {
  guid: string;
  description: string;
}): SourceRow {
  return {
    entity_id: r.guid,
    title: clean(r.description) || null,
    text: clean(r.description),
    slug: null,
    ref: null,
  };
}

export const loadNarration = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_narration')
    .select(['guid', 'description'])
    .execute()) as Array<{ guid: string; description: string }>;
  return rows.map((r) => narrationRowToSource(r));
};

// ─── Page ────────────────────────────────────────────────────────────────────
// Table: bom_page
// Columns used: guid (PK string), title (string), ref (string|null)
// entity_id: guid
// slug: null — page URLs are resolved through bom_slug; that join is expensive
//              and unnecessary for embedding; omit here
// ref: bom_page.ref — scripture reference string (e.g. "1-nephi-1") or null

export function pageRowToSource(r: {
  guid: string;
  title: string;
  ref: string | null;
}): SourceRow {
  return {
    entity_id: r.guid,
    title: clean(r.title) || null,
    text: clean(r.title),
    slug: null,
    ref: clean(r.ref) || null,
  };
}

export const loadPages = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_page')
    .select(['guid', 'title', 'ref'])
    .execute()) as Array<{ guid: string; title: string; ref: string | null }>;
  return rows.map((r) => pageRowToSource(r));
};

// ─── Event ───────────────────────────────────────────────────────────────────
// Table: bom_xtras_history
// Columns used: id (number|null), slug (string), document (string|null),
//               source (string|null), teaser (string|null), year (number|null),
//               event_year (number|null)
// entity_id: String(id) when present, fallback to slug (id is nullable)
// title: document ?? source (best available human-readable label)
// text: join(document, source, teaser)
// slug: history/<slug> — history items have a slug column
// ref: event_year ?? year → coerced to string

export function eventRowToSource(r: {
  id: number | null;
  slug: string;
  document: string | null;
  source: string | null;
  teaser: string | null;
  year: number | null;
  event_year: number | null;
}): SourceRow {
  const labelTitle = clean(r.document) || clean(r.source) || null;
  const refYear = r.event_year ?? r.year;
  return {
    entity_id: r.id != null ? String(r.id) : r.slug,
    title: labelTitle,
    text: join(r.document, r.source, r.teaser),
    slug: `history/${r.slug}`,
    ref: refYear != null ? String(refYear) : null,
  };
}

export const loadEvents = async (db: Kysely<DB>): Promise<SourceRow[]> => {
  const rows = (await db
    .selectFrom('bom_xtras_history')
    .select(['id', 'slug', 'document', 'source', 'teaser', 'year', 'event_year'])
    .execute()) as Array<{ id: number | null; slug: string; document: string | null; source: string | null; teaser: string | null; year: number | null; event_year: number | null }>;
  return rows.map((r) => eventRowToSource(r));
};

// ─── Registry ────────────────────────────────────────────────────────────────

export const TYPE_CONFIGS: Array<{ cfg: TypeConfig; load: (db: Kysely<DB>) => Promise<SourceRow[]> }> = [
  { cfg: { type: 'person',      chunk: false },                 load: loadPeople },
  { cfg: { type: 'place',       chunk: false },                 load: loadPlaces },
  { cfg: { type: 'commentary',  chunk: true, maxChars: 600 },   load: loadCommentary },
  { cfg: { type: 'narration',   chunk: false },                 load: loadNarration },
  { cfg: { type: 'page',        chunk: false },                 load: loadPages },
  { cfg: { type: 'event',       chunk: false },                 load: loadEvents },
];
