#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Emit a candidate-QA-compatible audit containing every indexed verse in the
 * requested shadow editions. Read-only and deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import {
  loadShadowRows,
  openShadow,
  type ShadowGeometry,
} from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const versions = flag('versions', '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const outputFile = path.resolve(flag(
  'out',
  '../docs/audits/fax-geometry/shadow/all-candidates/audit.json',
));
if (!versions.length) throw new Error('--versions is required');

const db = openShadow(shadowFile, { queryOnly: true });
const rows = loadShadowRows(db, { versions });
db.close();
const byPair = new Map<string, ShadowGeometry[]>();
for (const row of rows) {
  const key = `${row.version}|${row.verseId}`;
  const pairRows = byPair.get(key) ?? [];
  pairRows.push(row);
  byPair.set(key, pairRows);
}
const findings = [...byPair.entries()]
  .map(([key, pairRows]) => {
    const [version, verseIdText] = key.split('|');
    const verseId = Number(verseIdText);
    return {
      severity: 'critical',
      code: 'EXHAUSTIVE_VERSION_QA',
      message: 'Exhaustive indexed-verse render candidate',
      version,
      verseId,
      page: Math.min(...pairRows.map((row) => row.page)),
      details: {
        selector: canonicalSelector([verseId]),
        rows: pairRows.length,
        pages: new Set(pairRows.map((row) => row.page)).size,
      },
    };
  })
  .sort((left, right) =>
    left.version!.localeCompare(right.version!, undefined, { numeric: true }) ||
    left.verseId - right.verseId);
const report = {
  generatedAt: new Date().toISOString(),
  method: 'every indexed verse in requested shadow editions',
  shadowFile,
  versions,
  rows: rows.length,
  candidates: findings.length,
  findings,
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputFile,
  versions,
  rows: rows.length,
  candidates: findings.length,
}, null, 2));
