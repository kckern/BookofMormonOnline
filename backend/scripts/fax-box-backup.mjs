/**
 * fax-box-backup.mjs — dump bom_xtras_fax_index rows for a set of editions to
 * NDJSON, for reversibility before any data remediation.
 *
 * Part of the fax box-data remediation (verse_id mislabeling on the shared-plate
 * European editions). See docs/bugs/2026-07-25-fax-box-verseid-mismapping-euro-editions.md
 * and docs/plans/2026-07-25-fax-box-data-remediation.md.
 *
 * Usage (from backend/, with MYSQL_* in env — e.g. `set -a; . $XDG_RUNTIME_DIR/bom-dev.env; set +a`):
 *   node scripts/fax-box-backup.mjs 1849,1852,1854,1854l,1866,1871,1874,1877,rebom,poetic > backup.ndjson
 *
 * Restore is a separate deliberate step (write path), not automated here.
 */
import mysql from 'mysql2/promise';

const versions = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!versions.length) {
  console.error('usage: node scripts/fax-box-backup.mjs <ver1,ver2,...>');
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB || 'bom_prd',
});

const placeholders = versions.map(() => '?').join(',');
const [rows] = await conn.query(
  `SELECT uid, version, verse_id, page, pageWidth, pageScale, X, Y, W, H, TLW, TLH, BRW, BRH
   FROM bom_xtras_fax_index WHERE version IN (${placeholders}) ORDER BY version, page, Y`,
  versions,
);

for (const r of rows) process.stdout.write(JSON.stringify(r) + '\n');
await conn.end();
console.error(`backed up ${rows.length} rows across ${versions.length} editions`);
