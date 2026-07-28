#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Build an immutable semantic ownership manifest from cached Gemini line OCR.
 *
 * This never reads geometry to decide what text belongs to a verse.  It aligns
 * each cached page independently to the canonical word stream, then records
 * the exact printed line and token containing a verse's first and last word.
 * No model calls and no database writes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import { openShadow, shadowCanonicalText } from './lib/fax-shadow-db.ts';

type CachedLine = { text: string; box_2d: [number, number, number, number] };
type CachePage = { imgW: number; imgH: number; lines: CachedLine[] };
type Word = {
  raw: string;
  norm: string;
  line: number;
  token: number;
  column: number;
  xs: number;
  xe: number;
  y0: number;
  y1: number;
};
type RefWord = { norm: string; verseId: number; first: boolean };

const argv = process.argv.slice(2);
const flag = (name: string, fallback = ''): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const ocrRoot = path.resolve(flag(
  'ocr-root',
  '/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache',
));
const version = flag('reference-version');
const outFile = path.resolve(flag('out', 'line-ownership.ndjson'));
if (!version) throw new Error('--reference-version is required');

const normalize = (value: string): string => value
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '');
const tokens = (text: string): string[] => text.split(/\s+/).map(normalize).filter(Boolean);
const heading = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed || /^[\d.\s]+$/.test(trimmed)) return true;
  if (/^\s*(?:chap(?:ter)?\b|(?:the\s+)?book\s+of\b|the\s+(?:first|second|third|fourth)\b)/i.test(trimmed) && trimmed.length < 36) return true;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  return letters.length >= 2 && letters === letters.toUpperCase();
};

function lcs(left: string[], right: string[]): Array<[number, number]> {
  const rows = Array.from({ length: left.length + 1 }, () => new Int32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      rows[i]![j] = left[i] === right[j]
        ? rows[i + 1]![j + 1]! + 1
        : Math.max(rows[i + 1]![j]!, rows[i]![j + 1]!);
    }
  }
  const result: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { result.push([i, j]); i++; j++; }
    else if (rows[i + 1]![j]! >= rows[i]![j + 1]!) i++;
    else j++;
  }
  return result;
}

function mapper(anchors: Array<[number, number]>, wordCount: number): (ref: number) => number {
  return (ref) => {
    let before: [number, number] | null = null;
    let after: [number, number] | null = null;
    for (const anchor of anchors) {
      if (anchor[1] === ref) return anchor[0];
      if (anchor[1] < ref) before = anchor;
      else { after = anchor; break; }
    }
    if (before && after) {
      return Math.max(0, Math.min(wordCount - 1, Math.round(
        before[0] + (ref - before[1]) * (after[0] - before[0]) / (after[1] - before[1]),
      )));
    }
    if (before) return Math.min(wordCount - 1, before[0] + ref - before[1]);
    if (after) return Math.max(0, after[0] - (after[1] - ref));
    return 0;
  };
}

function runForward(words: Word[], start: number, expected: string[]): number {
  let length = 0;
  while (length < expected.length && words[start + length] &&
    words[start + length]!.norm === expected[length]) length++;
  return length;
}
function runBackward(words: Word[], end: number, expected: string[]): number {
  let length = 0;
  while (length < expected.length && words[end - length] &&
    words[end - length]!.norm === expected[expected.length - 1 - length]) length++;
  return length;
}

function pageWords(page: CachePage): Word[] {
  const usable = page.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !heading(line.text));
  const centers = usable.map(({ line }) => (line.box_2d[1] + line.box_2d[3]) / 2);
  const split = centers.length >= 6 &&
    centers.some((center) => center < 500) && centers.some((center) => center >= 500);
  const output: Word[] = [];
  for (const { line, index } of usable) {
    const [y0, x0, y1, x1] = line.box_2d.map(Number) as [number, number, number, number];
    const rawTokens = [...line.text.matchAll(/\S+/g)];
    const column = split && (x0 + x1) / 2 >= 500 ? 1 : 0;
    for (let token = 0; token < rawTokens.length; token++) {
      const match = rawTokens[token]!;
      const raw = match[0];
      const norm = normalize(raw);
      if (!norm) continue;
      output.push({
        raw,
        norm,
        line: index,
        token,
        column,
        xs: x0 + match.index! / Math.max(1, line.text.length) * (x1 - x0),
        xe: x0 + (match.index! + raw.length) / Math.max(1, line.text.length) * (x1 - x0),
        y0,
        y1,
      });
    }
  }
  output.sort((a, b) => a.column - b.column || a.line - b.line || a.token - b.token);
  return output;
}

const db = openShadow(shadowFile, { queryOnly: true });
const canonical = shadowCanonicalText(db);
db.close();
const allReference: RefWord[] = [];
for (const [verseId, text] of [...canonical.entries()].sort((a, b) => a[0] - b[0])) {
  let first = true;
  for (const norm of tokens(text)) {
    allReference.push({ norm, verseId, first });
    first = false;
  }
}
const byDistinctive = new Map<string, number[]>();
allReference.forEach((word, index) => {
  if (word.norm.length < 5) return;
  const locations = byDistinctive.get(word.norm) ?? [];
  locations.push(index);
  byDistinctive.set(word.norm, locations);
});

const cacheDir = path.join(ocrRoot, version);
if (!fs.existsSync(cacheDir)) throw new Error(`OCR cache not found: ${cacheDir}`);
const records: string[] = [];
let accepted = 0;
let unresolved = 0;
for (const file of fs.readdirSync(cacheDir).filter((name) => /^\d{3}\.json$/.test(name)).sort()) {
  const page = Number(file.slice(0, 3));
  const cached = JSON.parse(fs.readFileSync(path.join(cacheDir, file), 'utf8')) as CachePage;
  if (!cached.lines?.length) continue;
  const words = pageWords(cached);
  if (words.length < 8) continue;
  const votes = new Map<number, number>();
  words.forEach((word, index) => {
    if (word.norm.length < 5) return;
    const locations = byDistinctive.get(word.norm) ?? [];
    if (locations.length > 60) return;
    for (const location of locations) {
      const key = Math.round((location - index) / 8) * 8;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  });
  const peak = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!peak || peak[1] < 3) continue;
  const pairs: Array<[number, number]> = [];
  words.forEach((word, index) => {
    if (word.norm.length < 5) return;
    for (const location of byDistinctive.get(word.norm) ?? []) {
      if (Math.abs((location - index) - peak[0]) <= 40) pairs.push([index, location]);
    }
  });
  const offsets = pairs.map(([, offset]) => offset).sort((a, b) => a - b);
  const offset = offsets[Math.floor(offsets.length / 2)]!;
  const start = Math.max(0, offset - 70);
  const end = Math.min(allReference.length, offset + words.length + 70);
  const ref = allReference.slice(start, end);
  const anchors = lcs(words.map((word) => word.norm), ref.map((word) => word.norm));
  if (anchors.length < 3) continue;
  const map = mapper(anchors, words.length);
  const firstAnchor = anchors[0]![1];
  const lastAnchor = anchors.at(-1)![1];
  for (let index = 0; index < ref.length; index++) {
    if (!ref[index]!.first) continue;
    const verseId = ref[index]!.verseId;
    let next = index + 1;
    while (next < ref.length && ref[next]!.verseId === verseId) next++;
    if (index > lastAnchor || next <= firstAnchor) continue;
    const startWord = map(index);
    const endWord = Math.max(startWord, map(next) - 1);
    const firstOwned = words[startWord];
    const lastOwned = words[endWord];
    const verseTokens = ref.slice(index, next).map((word) => word.norm);
    const startRun = runForward(words, startWord, verseTokens.slice(0, 5));
    const endRun = runBackward(words, endWord, verseTokens.slice(-5));
    const status = firstOwned && lastOwned && startRun >= Math.min(3, verseTokens.length) &&
      endRun >= Math.min(3, verseTokens.length) ? 'ACCEPTED' : 'BOUNDARY_AMBIGUOUS';
    const record = {
      referenceVersion: version,
      verseId,
      selector: canonicalSelector([verseId]),
      page,
      image: { width: cached.imgW, height: cached.imgH },
      column: firstOwned?.column ?? null,
      startLineOrdinal: firstOwned?.line ?? null,
      startTokenOrdinal: firstOwned?.token ?? null,
      endLineOrdinal: lastOwned?.line ?? null,
      endTokenOrdinal: lastOwned?.token ?? null,
      startLineText: firstOwned ? cached.lines[firstOwned.line]!.text : null,
      endLineText: lastOwned ? cached.lines[lastOwned.line]!.text : null,
      precedingToken: words[startWord - 1]?.raw ?? null,
      firstOwnedToken: firstOwned?.raw ?? null,
      lastOwnedToken: lastOwned?.raw ?? null,
      followingToken: words[endWord + 1]?.raw ?? null,
      startGap: firstOwned ? { left: words[startWord - 1]?.xe ?? null, right: firstOwned.xs, y0: firstOwned.y0, y1: firstOwned.y1 } : null,
      endGap: lastOwned ? { left: lastOwned.xe, right: words[endWord + 1]?.xs ?? null, y0: lastOwned.y0, y1: lastOwned.y1 } : null,
      anchors: anchors.length,
      startRun,
      endRun,
      status,
    };
    records.push(JSON.stringify(record));
    if (status === 'ACCEPTED') accepted++; else unresolved++;
  }
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${records.join('\n')}\n`);
console.log(JSON.stringify({ outFile, version, records: records.length, accepted, unresolved }, null, 2));
