/**
 * messaging/contentRefs.ts — scripture reference translation helpers.
 *
 * Provides conversion between human-readable scripture reference strings,
 * numeric verse ids (scripture-guide canonical), legacy (slug, ordinal) pairs,
 * and rich display objects backed by the DB.
 *
 * Phase 1 scope:
 *   refToVerseIds / verseIdsToRef — pure, no DB
 *   legacyRefToVerseIds           — DB: (slug, ordinal) → verse ids
 *   resolveVerseDisplay           — DB: verse id → { slug, ordinal, text }
 *   Reference type + resolveReference — dispatcher (verse wired; others deferred)
 */

import { lookup as lookupReference, generateReference } from 'scripture-guide';
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { SlugResolver } from '../data/slugResolver.js';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a human-readable scripture reference (e.g. "Alma 32:21") to a
 * sorted, de-duped array of numeric verse ids.  Returns [] for any
 * unrecognised or empty input.
 */
export function refToVerseIds(ref: string): number[] {
  if (!ref || typeof ref !== 'string') return [];
  const ids = lookupReference(ref.replace(/[–—]/g, '-'))?.verse_ids ?? [];
  if (!ids.length) return [];
  return [...new Set(ids)].sort((a, z) => a - z);
}

/**
 * Convert a sorted array of verse ids back to a human-readable reference
 * string.  Returns '' for an empty array.
 */
export function verseIdsToRef(verseIds: number[]): string {
  if (!verseIds?.length) return '';
  return generateReference([...verseIds].sort((a, z) => a - z));
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Resolve a legacy (slug, ordinal) pair to verse ids via:
 *   bom_slug(slug=<slug>, type='PG').link  → page guid
 *   bom_text(page=<page>, link=<ordinal>).min_verse_id
 *
 * If slug has no PG row, the last path segment is tried as a fallback.
 * Units with NULL min_verse_id (non-verse headings, etc.) return [].
 */
export async function legacyRefToVerseIds(
  db: Kysely<DB>,
  slug: string,
  ordinal: number,
): Promise<number[]> {
  const pgLink = async (s: string): Promise<string | null> =>
    (
      await db
        .selectFrom('bom_slug')
        .select('link')
        .where('slug', '=', s)
        .where('type', '=', 'PG')
        .executeTakeFirst()
    )?.link ?? null;

  let page = await pgLink(slug);
  if (!page) {
    const leaf = slug.split('/').pop();
    if (leaf && leaf !== slug) page = await pgLink(leaf);
  }
  if (!page) return [];

  const unit = await db
    .selectFrom('bom_text')
    .select('min_verse_id')
    .where('page', '=', page)
    .where('link', '=', ordinal)
    .executeTakeFirst();

  return unit?.min_verse_id ? [Number(unit.min_verse_id)] : [];
}

// ─── Display resolution ───────────────────────────────────────────────────────

export interface VerseDisplay {
  slug: string;
  ordinal: number;
  text: string;
}

/**
 * Resolve a verse id to a display object: { slug, ordinal, text }.
 *
 * Lookup path:
 *   bom_text WHERE min_verse_id = verseId → page guid + link (ordinal) + content
 *   page guid → SlugResolver.pathsForLinks → page slug path
 *   slug = page slug path + "/" + ordinal
 *
 * Returns null if the verse id is not found or has no page mapping.
 */
export async function resolveVerseDisplay(
  db: Kysely<DB>,
  verseId: number,
): Promise<VerseDisplay | null> {
  const unit = await db
    .selectFrom('bom_text')
    .select(['page', 'link', 'content'])
    .where('min_verse_id', '=', verseId)
    .executeTakeFirst();

  if (!unit?.page || unit.link == null) return null;

  const pageSlugs = await new SlugResolver(db).pathsForLinks([unit.page]);
  const pagePath = pageSlugs.get(unit.page);
  if (!pagePath) return null;

  const ordinal = Number(unit.link);
  const slug = `${pagePath}/${ordinal}`;
  const text = String(unit.content ?? '');

  return { slug, ordinal, text };
}

// ─── Reference type + dispatcher ─────────────────────────────────────────────

export type RefType =
  | 'verse'
  | 'legacy_text'
  | 'commentary'
  | 'image'
  | 'section'
  | 'fax'
  | 'person'
  | 'place'
  | 'object';

export type RefRole = 'subject' | 'highlight';

export interface Reference {
  type: RefType;
  id: string | number;
  role: RefRole;
  span?: { text: string };
  /** ordinal within a page — used by legacy_text refs */
  ordinal?: number;
  /** page slug — used by legacy_text and section refs */
  slug?: string;
}

export interface ResolvedReference extends Reference {
  display: Record<string, unknown>;
}

/**
 * Resolve a Reference to a ResolvedReference with a display object.
 * Currently wires 'verse' type; all other types return an empty display
 * (to be filled in by later phases).
 */
export async function resolveReference(
  db: Kysely<DB>,
  ref: Reference,
): Promise<ResolvedReference> {
  if (ref.type === 'verse') {
    const d = await resolveVerseDisplay(db, Number(ref.id));
    return { ...ref, display: (d as Record<string, unknown> | null) ?? {} };
  }
  return { ...ref, display: {} };
}
