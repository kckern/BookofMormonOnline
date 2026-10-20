import sharp from 'sharp';
import { sql } from 'kysely';
import { getDb } from '../../data/db.js';
import { MAX_PAGES } from './constants.js';
import { clampPages, toFragments } from './geometry.js';
import { imageScanMeta, verseIdsToBoxes } from './resolve.js';
import { fetchScan } from './scan.js';
import { cropVerdict, fragmentEdgeInk } from './validate.js';

// DB/scan-backed half of the showcase crop validation (pure checks in
// ./validate.ts, which explains the failure modes).

/** Box area per character of verse text, vs the median of the page's boxes:
 * outside [1/2.5, 2.5] is a degenerate or mislabelled box. */
const SIZE_RATIO_MAX = 2.5;

async function sizeOutlier(version: string, verseId: number, pages: number[]): Promise<boolean> {
  const db = getDb();
  const rows = await db.selectFrom('bom_xtras_fax_index as i')
    .innerJoin('lds_scriptures_verses as v', (j) => j.on(sql`v.verse_id`, '=', sql`CAST(i.verse_id AS UNSIGNED)`))
    .select(['i.verse_id as verseId', 'i.W as w', 'i.H as h', sql<number>`CHAR_LENGTH(v.verse_scripture)`.as('len')])
    .where('i.version', '=', version)
    .where('i.page', 'in', pages)
    .execute();
  const area = new Map<number, { a: number; len: number }>();
  for (const r of rows) {
    const id = Number(r.verseId);
    const cur = area.get(id) ?? { a: 0, len: Number(r.len) || 0 };
    cur.a += Number(r.w) * Number(r.h);
    area.set(id, cur);
  }
  // a verse continued from/onto another page only has part of its text here
  const ratios = [...area.entries()].filter(([, v]) => v.len > 0 && v.a > 0).map(([id, v]) => ({ id, r: v.a / v.len }));
  const mine = ratios.find((x) => x.id === verseId);
  if (!mine || ratios.length < 4) return false;
  const sorted = ratios.map((x) => x.r).sort((a, z) => a - z);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return mine.r < median / SIZE_RATIO_MAX || mine.r > median * SIZE_RATIO_MAX;
}

// Verdicts are a pure function of (edition, verse) geometry + scan, which
// change only on a data fix; keep them for the process lifetime, bounded.
const verdicts = new Map<string, Promise<boolean>>();
const VERDICT_CAP = 2000;
/** Test-only. */
export const __resetVerdicts = () => verdicts.clear();

/** True when this edition's crop of the verse frames whole words of a verse-sized box. */
export function verseCropOk(version: string, verseId: number): Promise<boolean> {
  const key = `${version}:${verseId}`;
  const hit = verdicts.get(key);
  if (hit) return hit;
  const p = (async () => {
    const boxes = await verseIdsToBoxes(version, [verseId]);
    if (!boxes.length) return false;
    const { fragments } = clampPages(toFragments(boxes), MAX_PAGES);
    const pages = [...new Set(fragments.map((f) => f.page))];
    // a verse that crosses pages is partly on each: the size test only
    // applies to a verse wholly on one page
    if (pages.length === 1 && (await sizeOutlier(version, verseId, pages))) return false;
    const { offset, format } = await imageScanMeta(version);
    for (const f of fragments) {
      const scan = await fetchScan(version, f.page + offset, format);
      const meta = await sharp(scan).metadata();
      const k = (meta.width ?? f.pageScale) / f.pageScale;
      const e = await fragmentEdgeInk(scan, { x: f.x * k, y: f.y * k, w: f.w * k, h: f.h * k });
      if (cropVerdict(e) !== 'ok') return false;
    }
    return true;
  })().catch(() => {
    // a transient failure (scan fetch, DB) is not a verdict: retry next time
    verdicts.delete(key);
    return false;
  });
  if (verdicts.size >= VERDICT_CAP) verdicts.delete(verdicts.keys().next().value!);
  verdicts.set(key, p);
  return p;
}

