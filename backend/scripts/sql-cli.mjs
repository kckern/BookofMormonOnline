/**
 * sql-cli.mjs — run raw SQL against the configured MySQL DB (src/data/db.js).
 *
 * Usage:
 *   npx tsx scripts/sql-cli.mjs path/to/file.sql            # dry run (default): lists statements, executes nothing
 *   npx tsx scripts/sql-cli.mjs path/to/file.sql --execute   # actually runs them
 *   npx tsx scripts/sql-cli.mjs -e "SELECT 1" --execute
 *
 * SANDBOX DOES NOT APPLY HERE. src/data/sandboxDialect.ts only intercepts
 * Kysely query-builder Insert/Update/Delete/Merge nodes; a raw `sql.raw(...)`
 * statement compiles to a RawNode, which is a documented gap in that
 * suppression. Every statement this CLI executes hits MySQL for real,
 * regardless of SANDBOX=1/0 — the only backstop is whatever privileges
 * MYSQL_USER actually has. Check MYSQL_HOST/MYSQL_USER/MYSQL_DB below before
 * passing --execute.
 *
 * Statement splitting is a single-pass scanner that tracks single-quoted
 * string state (honoring both `\'` backslash-escaping and `''` doubling) so
 * that semicolons, `--` comments, and newlines *inside* quoted values don't
 * fracture a statement — money-quote text routinely contains all three.
 */
import { getDb, closeDb } from '../src/data/db.js';
import { sql } from 'kysely';
import { readFileSync } from 'node:fs';

function splitStatements(text) {
  const statements = [];
  let current = '';
  let inString = false;
  let atLineStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString && atLineStart && ch === '-' && text[i + 1] === '-') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    atLineStart = ch === '\n';
    if (inString && ch === '\\') {
      current += ch + (text[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === "'") {
      if (inString && text[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inString = !inString;
      current += ch;
      continue;
    }
    if (ch === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const execute = args.includes('--execute');
  const eIdx = args.indexOf('-e');
  if (eIdx !== -1) {
    const stmt = args[eIdx + 1];
    if (!stmt) {
      console.error('Usage: sql-cli.mjs -e "<statement>" [--execute]');
      process.exit(1);
    }
    return { statements: [stmt], execute, source: '-e' };
  }
  const file = args.find((a) => !a.startsWith('-'));
  if (!file) {
    console.error('Usage: sql-cli.mjs <file.sql> | -e "<statement>" [--execute]');
    process.exit(1);
  }
  const statements = splitStatements(readFileSync(file, 'utf8'));
  return { statements, execute, source: file };
}

async function main() {
  const { statements, execute, source } = parseArgs(process.argv);
  console.log(`Source: ${source}`);
  console.log(`MYSQL_HOST=${process.env.MYSQL_HOST} MYSQL_USER=${process.env.MYSQL_USER} MYSQL_DB=${process.env.MYSQL_DB}`);
  console.log(`${statements.length} statement(s)${execute ? '' : ' — DRY RUN, pass --execute to actually run them'}`);

  if (!execute) {
    statements.forEach((stmt, i) => console.log(`[${i + 1}/${statements.length}] ${stmt.slice(0, 160)}`));
    return;
  }

  const db = getDb();
  let ok = 0;
  let failed = 0;
  for (const [i, stmt] of statements.entries()) {
    try {
      const result = await sql.raw(stmt).execute(db);
      const isWrite = result.numAffectedRows !== undefined && result.numAffectedRows !== null;
      if (isWrite) {
        console.log(`[${i + 1}/${statements.length}] OK — affected: ${result.numAffectedRows}`);
      } else {
        console.log(`[${i + 1}/${statements.length}] OK — ${result.rows.length} row(s)`);
        console.log(JSON.stringify(result.rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
      }
      ok++;
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] FAILED: ${err.message}`);
      failed++;
    }
  }
  await closeDb();
  console.log(`Done. ${ok} ok, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
