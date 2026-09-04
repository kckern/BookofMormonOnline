/** Read-only readiness check for style-weighted bom_text selection. */
import 'dotenv/config';
import { sql } from 'kysely';
import { closeDb, getDb } from '../src/data/db.js';

async function main() {
  const db = getDb();
  try {
    const invalid = await sql<{ verseId: number; style: string | null }>`
      SELECT verse.verse_id AS verseId, MAX(line.style) AS style
      FROM lds_scriptures_verses verse
      LEFT JOIN lds_scriptures_lines line ON line.verse_id = verse.verse_id
        AND line.style IN ('discourse', 'poetry', 'narrative')
      WHERE verse.verse_id BETWEEN 31103 AND 37706
      GROUP BY verse.verse_id
      HAVING COUNT(line.guid) = 0
      ORDER BY verse.verse_id LIMIT 25
    `.execute(db);
    const unmapped = await sql<{ guid: string; minVerseId: number }>`
      SELECT t.guid, t.min_verse_id AS minVerseId FROM bom_text t
      WHERE t.min_verse_id BETWEEN 31103 AND 37706
        AND NOT EXISTS (
          SELECT 1 FROM lds_scriptures_lines s
          WHERE s.verse_id = t.min_verse_id
            AND s.style IN ('discourse', 'poetry', 'narrative')
        )
      ORDER BY t.min_verse_id LIMIT 25
    `.execute(db);
    if (invalid.rows.length || unmapped.rows.length) {
      console.error({ invalidVerses: invalid.rows, unselectableBlocks: unmapped.rows });
      throw new Error('scripture style coverage is incomplete');
    }
    console.log('VALID: every Book of Mormon verse and bom_text block start has a supported style');
  } finally { await closeDb(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
