import type { Kysely } from 'kysely';
import { detectReferences, generateReference, lookup, type LanguageCode } from 'scripture-guide';
import type { DB } from '../../codegen/db.js';

const BOM_FIRST_VERSE_ID = 31_103;
const BOM_LAST_VERSE_ID = 37_706;

export interface ScriptureBridgeResult {
  bookOfMormonRefs: string[];
  bibleRefs: string[];
  edges: Array<{ bookOfMormonRef: string; bibleRef: string; type: string; source: string }>;
}

/** Detect references using scripture-guide without rewriting the source text. */
export function detectReferenceStrings(text: string, lang: string = 'en'): string[] {
  const refs: string[] = [];
  detectReferences(text, (reference) => {
    refs.push(reference);
    return reference;
  }, lang as LanguageCode);
  return [...new Set(refs)];
}

/**
 * Traverse the maintained scripture graph in either direction, restricting the
 * result to Book of Mormon ↔ Bible edges. No fuzzy/vector inference is used for
 * this relationship: every returned edge retains its DB type and source.
 */
export async function bridgeBookOfMormonToBible(
  db: Kysely<DB>,
  textOrReference: string,
): Promise<ScriptureBridgeResult> {
  const detected = detectReferenceStrings(textOrReference);
  const candidates = detected.length ? detected : [textOrReference];
  const bomIds = [...new Set(candidates.flatMap((reference) => lookup(reference).verse_ids)
    .filter((id) => id >= BOM_FIRST_VERSE_ID && id <= BOM_LAST_VERSE_ID))];
  if (!bomIds.length) return { bookOfMormonRefs: [], bibleRefs: [], edges: [] };

  const rows = await db.selectFrom('lds_scriptures_crossref').select([
    'src_verse_id', 'dst_verse_id', 'type', 'source',
  ]).where((eb) => eb.or([
    eb.and([eb('src_verse_id', 'in', bomIds), eb('dst_verse_id', '<', BOM_FIRST_VERSE_ID)]),
    eb.and([eb('dst_verse_id', 'in', bomIds), eb('src_verse_id', '<', BOM_FIRST_VERSE_ID)]),
  ])).execute();

  const edges = rows.map((row) => {
    const sourceIsBom = row.src_verse_id >= BOM_FIRST_VERSE_ID;
    const bomId = sourceIsBom ? row.src_verse_id : row.dst_verse_id;
    const bibleId = sourceIsBom ? row.dst_verse_id : row.src_verse_id;
    return {
      bookOfMormonRef: generateReference(bomId),
      bibleRef: generateReference(bibleId),
      type: row.type,
      source: row.source,
    };
  });
  return {
    bookOfMormonRefs: [...new Set(edges.map((edge) => edge.bookOfMormonRef))],
    bibleRefs: [...new Set(edges.map((edge) => edge.bibleRef))],
    edges,
  };
}
