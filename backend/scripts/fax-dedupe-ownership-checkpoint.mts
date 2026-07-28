#!/usr/bin/env npx tsx
/**
 * Normalize an interrupted line-ownership checkpoint.
 *
 * The reconstructor is restartable by `version:selector`.  If an operator
 * accidentally starts more than one worker, duplicate append records can
 * occur.  This utility retains the last complete record for every key and
 * rewrites the checkpoint atomically.  It never touches either SQLite DB.
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const index = argv.indexOf('--file');
if (index < 0 || !argv[index + 1]) {
  throw new Error('usage: --file <proposals.ndjson>');
}
const file = path.resolve(argv[index + 1]!);
const rows = fs.readFileSync(file, 'utf8').split(/\n+/)
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line) as { version: string; selector: string });
const byKey = new Map<string, typeof rows[number]>();
for (const row of rows) byKey.set(`${row.version}:${row.selector}`, row);
const unique = [...byKey.values()].sort((left, right) =>
  `${left.version}:${left.selector}`.localeCompare(`${right.version}:${right.selector}`, undefined, {
    numeric: true,
  }));
const temporary = `${file}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${unique.map((row) => JSON.stringify(row)).join('\n')}\n`);
fs.renameSync(temporary, file);
console.log(JSON.stringify({ file, before: rows.length, after: unique.length, removed: rows.length - unique.length }, null, 2));
