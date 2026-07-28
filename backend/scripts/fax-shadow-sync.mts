#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Extract the current production fax data through the supplied read-only DB
 * CLI and atomically rebuild a local SQLite shadow database.
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const dbCli = path.resolve(flag(
  'db-cli',
  '/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/cli/db.mjs',
));
const outputFile = path.resolve(flag('out', '.shadow/fax-shadow.sqlite'));
const manifestFile = path.resolve(flag(
  'manifest',
  '.shadow/fax-shadow-manifest.json',
));
const nodeBinary = flag('node', '/opt/homebrew/bin/node');

type SourceRow = Record<string, unknown>;

async function extract(sql: string): Promise<SourceRow[]> {
  const { stdout } = await execFileAsync(
    nodeBinary,
    [dbCli, '--json', sql],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as SourceRow[];
  if (!Array.isArray(parsed)) throw new Error('DB CLI did not return a JSON array');
  return parsed;
}

const queries = {
  faxIndex: `
    SELECT uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,
           TLW,TLH,BRW,BRH
    FROM bom_xtras_fax_index
    ORDER BY uid
  `,
  faxMeta: `
    SELECT slug,pgfirstVerse,format,bgcolor
    FROM bom_xtras_fax
    ORDER BY slug
  `,
  canonical: `
    SELECT verse_id,verse_scripture
    FROM lds_scriptures_verses
    WHERE verse_id BETWEEN 31103 AND 37706
    ORDER BY verse_id
  `,
};

console.error(JSON.stringify({ stage: 'extract', dbCli, outputFile }));
const [faxIndex, faxMeta, canonical] = await Promise.all([
  extract(queries.faxIndex),
  extract(queries.faxMeta),
  extract(queries.canonical),
]);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
const temporaryFile = `${outputFile}.building-${process.pid}`;
if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
const db = new DatabaseSync(temporaryFile);
db.exec(`
  PRAGMA journal_mode=OFF;
  PRAGMA synchronous=OFF;
  PRAGMA temp_store=MEMORY;
  CREATE TABLE bom_xtras_fax_index (
    uid INTEGER PRIMARY KEY,
    version TEXT NOT NULL,
    verse_id INTEGER NOT NULL,
    page INTEGER NOT NULL,
    pageWidth INTEGER NOT NULL,
    pageScale INTEGER NOT NULL,
    X INTEGER NOT NULL,
    Y INTEGER NOT NULL,
    W INTEGER NOT NULL,
    H INTEGER NOT NULL,
    TLW INTEGER NOT NULL,
    TLH INTEGER NOT NULL,
    BRW INTEGER NOT NULL,
    BRH INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX fax_index_version_verse
    ON bom_xtras_fax_index(version,verse_id);
  CREATE INDEX fax_index_version_page
    ON bom_xtras_fax_index(version,page);
  CREATE TABLE bom_xtras_fax (
    slug TEXT PRIMARY KEY,
    pgfirstVerse INTEGER,
    format TEXT,
    bgcolor TEXT
  ) STRICT;
  CREATE TABLE lds_scriptures_verses (
    verse_id INTEGER PRIMARY KEY,
    verse_scripture TEXT NOT NULL
  ) STRICT;
  CREATE TABLE fax_shadow_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE fax_shadow_changes (
    change_id INTEGER PRIMARY KEY AUTOINCREMENT,
    applied_at TEXT NOT NULL,
    source_report TEXT NOT NULL,
    version TEXT NOT NULL,
    verse_id INTEGER NOT NULL,
    selector TEXT NOT NULL,
    outcome TEXT NOT NULL,
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL
  ) STRICT;
`);

const hash = crypto.createHash('sha256');
const insertFax = db.prepare(`
  INSERT INTO bom_xtras_fax_index
    (uid,version,verse_id,page,pageWidth,pageScale,X,Y,W,H,TLW,TLH,BRW,BRH)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const insertMeta = db.prepare(`
  INSERT INTO bom_xtras_fax (slug,pgfirstVerse,format,bgcolor)
  VALUES (?,?,?,?)
`);
const insertCanonical = db.prepare(`
  INSERT INTO lds_scriptures_verses (verse_id,verse_scripture) VALUES (?,?)
`);

db.exec('BEGIN IMMEDIATE');
try {
  for (const row of faxIndex) {
    const values = [
      Number(row.uid), String(row.version), Number(row.verse_id),
      Number(row.page), Number(row.pageWidth), Number(row.pageScale) || 700,
      Number(row.X), Number(row.Y), Number(row.W), Number(row.H),
      Number(row.TLW), Number(row.TLH), Number(row.BRW), Number(row.BRH),
    ] as const;
    insertFax.run(...values);
    hash.update(values.join('|')).update('\n');
  }
  for (const row of faxMeta) {
    insertMeta.run(
      String(row.slug),
      row.pgfirstVerse == null ? null : Number(row.pgfirstVerse),
      row.format == null ? null : String(row.format),
      row.bgcolor == null ? null : String(row.bgcolor),
    );
  }
  for (const row of canonical) {
    insertCanonical.run(Number(row.verse_id), String(row.verse_scripture));
  }
  const extractedAt = new Date().toISOString();
  const sourceHash = hash.digest('hex');
  const metadata = {
    extracted_at: extractedAt,
    source_db_cli: dbCli,
    source_fax_index_rows: String(faxIndex.length),
    source_fax_meta_rows: String(faxMeta.length),
    source_canonical_rows: String(canonical.length),
    source_fax_index_sha256: sourceHash,
  };
  const insertShadowMeta = db.prepare(
    'INSERT INTO fax_shadow_meta (key,value) VALUES (?,?)',
  );
  for (const [key, value] of Object.entries(metadata)) {
    insertShadowMeta.run(key, value);
  }
  db.exec(`
    CREATE TABLE fax_index_baseline AS
      SELECT * FROM bom_xtras_fax_index;
    CREATE UNIQUE INDEX fax_baseline_uid ON fax_index_baseline(uid);
    CREATE INDEX fax_baseline_version_verse
      ON fax_index_baseline(version,verse_id);
    COMMIT;
    PRAGMA journal_mode=DELETE;
  `);
  db.close();

  fs.renameSync(temporaryFile, outputFile);
  const manifest = {
    generatedAt: extractedAt,
    dbCli,
    outputFile,
    counts: {
      faxIndex: faxIndex.length,
      faxMeta: faxMeta.length,
      canonical: canonical.length,
    },
    sourceFaxIndexSha256: sourceHash,
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifestFile, ...manifest }, null, 2));
} catch (error) {
  try {
    db.exec('ROLLBACK');
  } catch {
    // Preserve the original failure.
  }
  db.close();
  if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  throw error;
}
