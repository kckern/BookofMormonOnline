#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Persist geometry normalizations that are provably render-equivalent to the
 * production runtime sanitizer:
 *   - inactive half-notches become 0/0;
 *   - negative origins are clamped to zero while width/height shrink by the
 *     same amount;
 *   - notch masks are clipped to the crop, exactly as renderFragmentCrop does;
 *   - non-positive boxes are removed, exactly as sanitizeBoxes does.
 *
 * No content-bearing active notch is changed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadShadowRows, openShadow, type ShadowGeometry } from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const outputFile = path.resolve(flag(
  'out',
  '.shadow/normalization-report.json',
));
const dryRun = hasFlag('dry-run');
const sourceReport = 'fax-shadow-normalize:runtime-equivalent-v2';

const db = openShadow(shadowFile);
const candidates = db.prepare(`
  SELECT uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH
  FROM bom_xtras_fax_index
  WHERE X<0 OR Y<0 OR W<=0 OR H<=0
     OR TLW<0 OR TLH<0 OR BRW<0 OR BRH<0
     OR TLW>W OR BRW>W OR TLH>H OR BRH>H
     OR (TLW=0 AND TLH<>0) OR (TLW<>0 AND TLH=0)
     OR (BRW=0 AND BRH<>0) OR (BRW<>0 AND BRH=0)
  ORDER BY version,verse_id,page,Y,X,uid
`).all() as Array<Record<string, unknown>>;

const affectedPairs = new Map<string, { version: string; verseId: number }>();
for (const row of candidates) {
  const version = String(row.version);
  const verseId = Number(row.verse_id);
  affectedPairs.set(`${version}|${verseId}`, { version, verseId });
}
const beforeByPair = new Map<string, ShadowGeometry[]>();
for (const [key, pair] of affectedPairs) {
  beforeByPair.set(key, loadShadowRows(db, {
    versions: [pair.version],
    verseIds: [pair.verseId],
  }));
}

const update = db.prepare(`
  UPDATE bom_xtras_fax_index
  SET X=?,Y=?,W=?,H=?,TLW=?,TLH=?,BRW=?,BRH=?
  WHERE uid=?
`);
const remove = db.prepare('DELETE FROM bom_xtras_fax_index WHERE uid=?');
const audit = db.prepare(`
  INSERT INTO fax_shadow_changes
    (applied_at,source_report,version,verse_id,selector,outcome,before_json,after_json)
  VALUES (?,?,?,?,?,?,?,?)
`);
let halfTl = 0;
let halfBr = 0;
let negative = 0;
let clippedNotches = 0;
let removedNonPositive = 0;

db.exec('BEGIN IMMEDIATE');
try {
  for (const row of candidates) {
    const oldX = Number(row.X);
    const oldY = Number(row.Y);
    const nextX = Math.max(0, oldX);
    const nextY = Math.max(0, oldY);
    const nextW = Number(row.W) - (nextX - oldX);
    const nextH = Number(row.H) - (nextY - oldY);
    if (nextW <= 0 || nextH <= 0) {
      remove.run(Number(row.uid));
      removedNonPositive++;
      continue;
    }
    const tlHalf =
      (Number(row.TLW) === 0) !== (Number(row.TLH) === 0);
    const brHalf =
      (Number(row.BRW) === 0) !== (Number(row.BRH) === 0);
    const rawTLW = tlHalf ? 0 : Math.max(0, Number(row.TLW));
    const rawTLH = tlHalf ? 0 : Math.max(0, Number(row.TLH));
    const rawBRW = brHalf ? 0 : Math.max(0, Number(row.BRW));
    const rawBRH = brHalf ? 0 : Math.max(0, Number(row.BRH));
    const nextTLW = Math.min(nextW, rawTLW);
    const nextTLH = Math.min(nextH, rawTLH);
    const nextBRW = Math.min(nextW, rawBRW);
    const nextBRH = Math.min(nextH, rawBRH);
    update.run(
      nextX, nextY, nextW, nextH,
      nextTLW, nextTLH, nextBRW, nextBRH,
      Number(row.uid),
    );
    if (tlHalf) halfTl++;
    if (brHalf) halfBr++;
    if (oldX < 0 || oldY < 0) negative++;
    if (nextTLW !== Number(row.TLW) ||
        nextTLH !== Number(row.TLH) ||
        nextBRW !== Number(row.BRW) ||
        nextBRH !== Number(row.BRH)) clippedNotches++;
  }
  for (const [key, pair] of affectedPairs) {
    const before = beforeByPair.get(key)!;
    const after = loadShadowRows(db, {
      versions: [pair.version],
      verseIds: [pair.verseId],
    });
    audit.run(
      new Date().toISOString(),
      sourceReport,
      pair.version,
      pair.verseId,
      `ids/${pair.verseId}`,
      'RENDER_EQUIVALENT_NORMALIZATION',
      JSON.stringify(before),
      JSON.stringify(after),
    );
  }
  if (dryRun) db.exec('ROLLBACK');
  else db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  db.close();
  throw error;
}

const remaining = db.prepare(`
  SELECT COUNT(*) AS count
  FROM bom_xtras_fax_index
  WHERE X<0 OR Y<0 OR W<=0 OR H<=0
     OR TLW<0 OR TLH<0 OR BRW<0 OR BRH<0
     OR TLW>W OR BRW>W OR TLH>H OR BRH>H
     OR (TLW=0 AND TLH<>0) OR (TLW<>0 AND TLH=0)
     OR (BRW=0 AND BRH<>0) OR (BRW<>0 AND BRH=0)
`).get() as { count: unknown };
db.close();

const result = {
  generatedAt: new Date().toISOString(),
  shadowFile,
  dryRun,
  candidateRows: candidates.length,
  affectedVerses: affectedPairs.size,
  normalizedHalfTl: halfTl,
  normalizedHalfBr: halfBr,
  normalizedNegativeOrigins: negative,
  clippedNotches,
  removedNonPositive,
  remaining: dryRun ? null : Number(remaining.count),
  status: dryRun ? 'DRY_RUN_PASS' : Number(remaining.count) === 0 ? 'PASS' : 'FAIL',
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputFile, ...result }, null, 2));
if (!dryRun && Number(remaining.count) !== 0) process.exitCode = 1;
