/**
 * fax-resequence.mjs — recompute correct verse_id labels for a fax edition by
 * walking its boxes in physical reading order (page, Y, X) and assigning the
 * contiguous canonical BoM verse_id range in order, preserving the existing
 * straddle grouping (consecutive boxes that currently share a verse_id are one
 * verse => reuse the id, don't advance).
 *
 * Read-only by default:
 *   --validate : run on an edition, compare computed labels to the EXISTING ones,
 *                print match rate + first mismatches. Run this on a KNOWN-CORRECT
 *                edition (1830/1842) first — it must reproduce their labels.
 *   --emit     : print NDJSON {uid, old, new} for every row whose label changes
 *                (this is the proposed write; no DB write happens here).
 *
 * Usage (backend/, MYSQL_* in env):
 *   node scripts/fax-resequence.mjs 1842 --validate
 *   node scripts/fax-resequence.mjs 1871 --emit > /tmp/1871-relabel.ndjson
 *
 * See docs/plans/2026-07-25-fax-box-data-remediation.md.
 */
import mysql from 'mysql2/promise';

const version = process.argv[2];
const mode = process.argv.includes('--emit') ? 'emit' : 'validate';
if (!version) { console.error('usage: node scripts/fax-resequence.mjs <version> [--validate|--emit]'); process.exit(1); }

// Canonical BoM verse_id range is contiguous (confirmed: 1871 has 6604 distinct
// ids spanning exactly 31103..37706). We derive [min,max] from the edition itself
// so the range can't drift, and assert it is dense.
const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB || 'bom_prd',
});
const [rows] = await conn.query(
  `SELECT uid, verse_id+0 AS vid, page, X, Y FROM bom_xtras_fax_index WHERE version=? ORDER BY page, Y, X`,
  [version],
);
await conn.end();

const distinct = new Set(rows.map((r) => r.vid));
const minv = Math.min(...distinct), maxv = Math.max(...distinct);
const dense = (maxv - minv + 1) === distinct.size;
console.error(`${version}: ${rows.length} boxes, ${distinct.size} distinct verses, range ${minv}..${maxv}, dense=${dense}`);

// Walk in reading order. Advance the canonical id whenever the CURRENT stored
// verse_id differs from the previous box's stored verse_id (a straddle keeps the
// same stored id on both boxes, so we don't advance across it).
let curNew = minv;
let prevOld = null;
const proposed = []; // {uid, old, new}
for (const r of rows) {
  if (prevOld !== null && r.vid !== prevOld) curNew += 1;
  proposed.push({ uid: r.uid, old: r.vid, neu: curNew });
  prevOld = r.vid;
}
const lastNew = curNew;

if (mode === 'validate') {
  let match = 0;
  const mismatches = [];
  for (const p of proposed) {
    if (p.old === p.neu) match += 1;
    else if (mismatches.length < 12) mismatches.push(p);
  }
  const pct = ((match / proposed.length) * 100).toFixed(2);
  console.log(`match ${match}/${proposed.length} (${pct}%)  computed range ${minv}..${lastNew} (expected ..${maxv}, ${lastNew === maxv ? 'OK' : 'OFF by ' + (maxv - lastNew)})`);
  if (mismatches.length) {
    console.log('first mismatches (uid: old -> computed):');
    for (const m of mismatches) console.log(`  ${m.uid}: ${m.old} -> ${m.neu}`);
  }
} else {
  let changed = 0;
  for (const p of proposed) {
    if (p.old !== p.neu) { process.stdout.write(JSON.stringify({ uid: p.uid, old: p.old, new: p.neu }) + '\n'); changed += 1; }
  }
  console.error(`${changed}/${proposed.length} rows would change; computed range ${minv}..${lastNew} (expected ..${maxv})`);
}
