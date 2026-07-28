#!/usr/bin/env npx tsx
/** Read-only geometry/text inspector for targeted audit adjudication. */
import { getDb, closeDb } from '../src/data/db.ts';
import { canonicalSelector } from '../src/media/fax/canonical.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const version = flag('version');
const verseIds = flag('verse-ids')
  .split(',')
  .map(Number)
  .filter(Number.isInteger);
if (!version || !verseIds.length) {
  throw new Error('usage: --version VERSION --verse-ids ID[,ID...]');
}

const db = getDb();
try {
  const [rows, verses] = await Promise.all([
    db.selectFrom('bom_xtras_fax_index')
      .select([
        'uid', 'version', 'verse_id', 'page', 'pageWidth', 'pageScale',
        'X', 'Y', 'W', 'H', 'TLW', 'TLH', 'BRW', 'BRH',
      ])
      .where('version', '=', version)
      .where('verse_id', 'in', verseIds)
      .orderBy('page')
      .orderBy('Y')
      .orderBy('X')
      .execute(),
    db.selectFrom('lds_scriptures_verses')
      .select(['verse_id', 'verse_scripture'])
      .where('verse_id', 'in', verseIds)
      .execute(),
  ]);
  const text = new Map(verses.map((verse) => [
    Number(verse.verse_id),
    String(verse.verse_scripture),
  ]));
  console.log(JSON.stringify(rows.map((row) => {
    const verseId = Number(row.verse_id);
    return {
      uid: Number(row.uid),
      version: String(row.version),
      verseId,
      selector: canonicalSelector([verseId]),
      canonicalText: text.get(verseId) ?? null,
      page: Number(row.page),
      pageWidth: Number(row.pageWidth),
      pageScale: Number(row.pageScale),
      X: Number(row.X),
      Y: Number(row.Y),
      W: Number(row.W),
      H: Number(row.H),
      TLW: Number(row.TLW),
      TLH: Number(row.TLH),
      BRW: Number(row.BRW),
      BRH: Number(row.BRH),
      visibleTopStartX: Number(row.X) + Number(row.TLW),
      visibleBottomEndX: Number(row.X) + Number(row.W) - Number(row.BRW),
    };
  }), null, 2));
} finally {
  await closeDb();
}
