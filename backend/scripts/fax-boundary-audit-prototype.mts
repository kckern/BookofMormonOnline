#!/usr/bin/env npx tsx
/**
 * Prototype for the deterministic fax notch-boundary audit.
 *
 * It combines canonical verse text, cached OCR line text, live geometry, and
 * scan-pixel whitespace. It never calls an LLM. This is intentionally an audit
 * prototype: it proposes repairs and emits evidence, but does not write SQL.
 *
 * Usage:
 *   npx tsx scripts/fax-boundary-audit-prototype.mts \
 *     --version 1852 --sample 36 --seed 20260725 \
 *     --ocr-root /path/to/scripts/out/ocr-cache \
 *     --out /tmp/fax-boundary-audit-1852.json
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getDb, closeDb } from '../src/data/db.ts';

type Row = {
  version: string;
  verseId: number;
  page: number;
  pageWidth: number;
  pageScale: number;
  X: number;
  Y: number;
  W: number;
  H: number;
  TLW: number;
  TLH: number;
  BRW: number;
  BRH: number;
};

type OcrLine = { text: string; box_2d: [number, number, number, number] };
type OcrPage = { imgW: number; imgH: number; lines: OcrLine[] };
type Token = { text: string; start: number; end: number };
type Gap = { lo: number; hi: number; mid: number; width: number; ink: number };

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const version = flag('version', '1852')!;
const sampleSize = Number(flag('sample', '36'));
const allRows = args.includes('--all');
const requestedVerseIds = new Set((flag('verse-ids', '') ?? '').split(',').map(Number).filter(Number.isInteger));
const seed = Number(flag('seed', '20260725'));
const ocrRoot = flag(
  'ocr-root',
  '/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/scripts/out/ocr-cache',
)!;
const media = flag('media', 'https://media.bookofmormon.online')!;
const outFile = flag('out');

const known: Record<number, string> = {
  31307: 'EM_DASH_SAME_LINE_BOUNDARY',
  33147: 'TL_PREFIX_CLIPS_FIRST_WORD',
  34939: 'FALSE_PAGE_END_NOTCH',
  36348: 'FALSE_CONTINUATION_NOTCHES',
  36456: 'BR_BOUNDARY_CUTS_NEXT_WORD',
};
const expectedByKey: Record<string, { shouldFlag: boolean; code?: string }> = {
  '31307|16': { shouldFlag: false },
  '33147|176': { shouldFlag: true, code: 'TL_NOT_IN_EXPECTED_WORD_GAP' },
  '34939|332': { shouldFlag: true, code: 'FALSE_BR_PAGE_CONTINUATION_NOTCH' },
  '36348|458': { shouldFlag: false },
  '36456|464': { shouldFlag: true, code: 'BR_NOT_IN_EXPECTED_WORD_GAP' },
  '32605|124': { shouldFlag: true, code: 'TL_NOT_IN_EXPECTED_WORD_GAP' },
};
const contentExpectations: Record<number, { shouldFlag: boolean; code?: string }> = {
  31606: { shouldFlag: true, code: 'CONTENT_SUFFIX_LEAK' },
  31833: { shouldFlag: true, code: 'CONTENT_SUFFIX_LEAK' },
  35730: { shouldFlag: false },
  36259: { shouldFlag: false },
  36935: { shouldFlag: false },
};

const normalizeWord = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const tokens = (s: string): Token[] => {
  const out: Token[] = [];
  for (const m of s.toLowerCase().matchAll(/[a-z]+(?:'[a-z]+)?/g)) {
    out.push({ text: normalizeWord(m[0]), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
};
const canonicalTokens = (s: string) => tokens(s).map((t) => t.text);

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

const sameToken = (a: string, b: string) =>
  a === b ||
  editDistanceAtMostOne(a, b) ||
  (a.length >= 5 && b.length >= 5 && a.replace(/s$/, '') === b.replace(/s$/, ''));

function findSequence(haystack: Token[], needle: string[], from = 0, last = false) {
  for (let n = Math.min(4, needle.length); n >= 2; n--) {
    const part = last ? needle.slice(-n) : needle.slice(0, n);
    const hits: number[] = [];
    for (let i = from; i <= haystack.length - n; i++) {
      if (part.every((w, j) => sameToken(haystack[i + j]!.text, w))) hits.push(i);
    }
    if (hits.length) return { index: last ? hits.at(-1)! : hits[0]!, length: n };
  }
  return null;
}

function findSuffixWithBoundaryContext(haystack: Token[], current: string[], next: string[]) {
  const multi = findSequence(haystack, current, 0, true);
  if (multi) return multi;
  const final = current.at(-1);
  if (!final) return null;
  for (let i = haystack.length - 1; i >= 0; i--) {
    if (!sameToken(haystack[i]!.text, final)) continue;
    const nextMatch = findSequence(haystack, next, i + 1);
    if (nextMatch?.index === i + 1) return { index: i, length: 1 };
  }
  return null;
}

function findPrefixAcrossNextLine(page: OcrPage, line: OcrLine, current: string[]) {
  const lineIndex = page.lines.indexOf(line);
  if (lineIndex < 0) return null;
  const entries: { token: Token; line: OcrLine; localIndex: number }[] = [];
  for (const source of page.lines.slice(lineIndex, lineIndex + 3)) {
    tokens(source.text).forEach((token, localIndex) => entries.push({ token, line: source, localIndex }));
  }
  const n = Math.min(5, current.length);
  for (let i = 0; i <= entries.length - n; i++) {
    if (!current.slice(0, n).every((word, j) => sameToken(entries[i + j]!.token.text, word))) continue;
    const first = entries[i]!;
    if (first.line === line) return { index: first.localIndex, length: n };
  }
  return null;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function lineRect(page: OcrPage, line: OcrLine) {
  const [y0, x0, y1, x1] = line.box_2d.map(Number);
  return {
    px: {
      x0: x0 / 1000 * page.imgW,
      x1: x1 / 1000 * page.imgW,
      y0: y0 / 1000 * page.imgH,
      y1: y1 / 1000 * page.imgH,
    },
    norm: {
      x0: x0 / 1000 * 700,
      x1: x1 / 1000 * 700,
      y0: y0 / 1000 * page.imgH / page.imgW * 700,
      y1: y1 / 1000 * page.imgH / page.imgW * 700,
    },
  };
}

function nearestLine(page: OcrPage, row: Row, edge: 'top' | 'bottom') {
  const target = edge === 'top'
    ? row.Y + (row.TLH > 0 ? row.TLH / 2 : 0)
    : row.Y + row.H - (row.BRH > 0 ? row.BRH / 2 : 0);
  return page.lines
    .map((line) => {
      const rect = lineRect(page, line);
      const y = edge === 'top'
        ? (row.TLH > 0 ? (rect.norm.y0 + rect.norm.y1) / 2 : rect.norm.y0)
        : (row.BRH > 0 ? (rect.norm.y0 + rect.norm.y1) / 2 : rect.norm.y1);
      const xOverlap = Math.max(0, Math.min(row.X + row.W, rect.norm.x1) - Math.max(row.X, rect.norm.x0));
      return { line, rect, distance: Math.abs(y - target), xOverlap };
    })
    .filter((x) => x.xOverlap > Math.min(30, row.W * 0.15))
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function lexicalX(
  page: OcrPage,
  line: OcrLine,
  charOffset: number,
) {
  const rect = lineRect(page, line);
  const fraction = charOffset / Math.max(1, line.text.length);
  return rect.px.x0 + fraction * (rect.px.x1 - rect.px.x0);
}

function pageThreshold(data: Buffer) {
  const values: number[] = [];
  for (let i = 0; i < data.length; i += 997) values.push(data[i]!);
  values.sort((a, b) => a - b);
  const ink = values[Math.floor(values.length * 0.15)]!;
  const paper = values[Math.floor(values.length * 0.85)]!;
  return { ink, paper, threshold: (ink + paper) / 2 };
}

function gapProfile(
  data: Buffer,
  width: number,
  height: number,
  line: ReturnType<typeof lineRect>['px'],
  threshold: number,
) {
  const x0 = Math.max(0, Math.floor(line.x0));
  const x1 = Math.min(width - 1, Math.ceil(line.x1));
  const y0 = Math.max(0, Math.floor(line.y0));
  const y1 = Math.min(height - 1, Math.ceil(line.y1));
  const profile: number[] = [];
  for (let x = x0; x <= x1; x++) {
    let dark = 0, n = 0;
    for (let y = y0; y <= y1; y++) {
      dark += Number(data[y * width + x]! < threshold);
      n++;
    }
    profile.push(n ? dark / n : 1);
  }
  const gaps: Gap[] = [];
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    const white = i < profile.length && profile[i]! <= 0.08;
    if (white && start < 0) start = i;
    if (!white && start >= 0) {
      if (i - start >= 2) {
        const slice = profile.slice(start, i);
        gaps.push({
          lo: x0 + start,
          hi: x0 + i - 1,
          mid: x0 + (start + i - 1) / 2,
          width: i - start,
          ink: slice.reduce((a, b) => a + b, 0) / slice.length,
        });
      }
      start = -1;
    }
  }
  return { x0, profile, gaps };
}

function chooseGap(gaps: Gap[], expectedPx: number, tolerancePx: number, direction: 'left' | 'any' = 'any') {
  let candidates = gaps.filter((g) => Math.abs(g.mid - expectedPx) <= tolerancePx);
  if (direction === 'left') {
    const left = candidates.filter((g) => g.mid <= expectedPx);
    if (left.length) candidates = left;
  }
  const usable = candidates.some((g) => g.width >= 3)
    ? candidates.filter((g) => g.width >= 3)
    : candidates;
  return usable.sort((a, b) =>
    Math.abs(a.mid - expectedPx) - Math.abs(b.mid - expectedPx) ||
    b.width - a.width
  )[0] ?? null;
}

function safelyInsideGap(x: number, gap: Gap | null) {
  if (!gap) return false;
  const margin = Math.min(2, Math.max(0.5, gap.width / 3));
  return x >= gap.lo + margin && x <= gap.hi - margin;
}

function profileAt(profile: ReturnType<typeof gapProfile>, x: number) {
  const i = Math.round(x) - profile.x0;
  if (i < 0 || i >= profile.profile.length) return null;
  return profile.profile[i]!;
}

function extractPolygonTokens(row: Row, page: OcrPage) {
  const out: { text: string; line: string }[] = [];
  for (const line of page.lines) {
    const rect = lineRect(page, line);
    const cy = (rect.norm.y0 + rect.norm.y1) / 2;
    if (cy < row.Y || cy > row.Y + row.H) continue;
    for (const token of tokens(line.text)) {
      const cxPx = lexicalX(page, line, (token.start + token.end) / 2);
      const cx = cxPx / page.imgW * 700;
      if (cx < row.X || cx > row.X + row.W) continue;
      const inTopNotch = row.TLW > 0 && row.TLH > 0 &&
        cy <= row.Y + row.TLH && cx < row.X + row.TLW;
      const inBottomNotch = row.BRW > 0 && row.BRH > 0 &&
        cy >= row.Y + row.H - row.BRH && cx > row.X + row.W - row.BRW;
      if (!inTopNotch && !inBottomNotch) out.push({ text: token.text, line: line.text });
    }
  }
  return out;
}

function fuzzyLcs(a: string[], b: string[]) {
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = sameToken(a[i - 1]!, b[j - 1]!)
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = a.length, j = b.length;
  while (i > 0 && j > 0) {
    if (sameToken(a[i - 1]!, b[j - 1]!) && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      pairs.push([i - 1, j - 1]); i--; j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) i--;
    else j--;
  }
  pairs.reverse();
  return pairs;
}

async function main() {
  const db = getDb();
  const [dbRows, verseRows, registry] = await Promise.all([
    db.selectFrom('bom_xtras_fax_index')
      .select(['version','verse_id','page','pageWidth','pageScale','X','Y','W','H','TLW','TLH','BRW','BRH'])
      .where('version', '=', version)
      .execute(),
    db.selectFrom('lds_scriptures_verses')
      .select(['verse_id','verse_scripture'])
      .where('verse_id', '>=', 31103)
      .where('verse_id', '<=', 37706)
      .execute(),
    db.selectFrom('bom_xtras_fax').select(['format', 'pgfirstVerse']).where('slug', '=', version).executeTakeFirst(),
  ]);
  await closeDb();

  const rows: Row[] = dbRows.map((r: any) => ({
    version,
    verseId: Number(r.verse_id),
    page: Number(r.page),
    pageWidth: Number(r.pageWidth),
    pageScale: Number(r.pageScale),
    X: Number(r.X), Y: Number(r.Y), W: Number(r.W), H: Number(r.H),
    TLW: Number(r.TLW), TLH: Number(r.TLH), BRW: Number(r.BRW), BRH: Number(r.BRH),
  }));
  // Index `page` is a stored fax page. OCR cache files and scan URLs are image
  // file pages, so every audit lookup must use this edition's constant offset.
  // Without it, nonzero-offset editions silently compare their geometry to the
  // wrong scan (e.g. 1882 box page 361 belongs to image 353).
  const minStoredPage = rows.length ? Math.min(...rows.map((r) => r.page)) : 0;
  const imageOffset = Number((registry as any)?.pgfirstVerse ?? 1) - minStoredPage;
  const imagePageOf = (row: Row) => row.page + imageOffset;
  const canon = new Map(verseRows.map((r: any) => [Number(r.verse_id), canonicalTokens(String(r.verse_scripture))]));
  const byVerse = new Map<number, Row[]>();
  for (const row of rows) (byVerse.get(row.verseId) ?? byVerse.set(row.verseId, []).get(row.verseId)!).push(row);
  for (const group of byVerse.values()) group.sort((a, b) => a.page - b.page);

  const rng = mulberry32(seed);
  const random = <T>(a: T[], n: number) =>
    a.map((x) => ({ x, p: rng() })).sort((a, b) => a.p - b.p).slice(0, n).map((x) => x.x);
  const knownRows = rows.filter((r) => known[r.verseId]);
  const knownKeys = new Set(knownRows.map((r) => `${r.verseId}|${r.page}`));
  const notched = rows.filter((r) => !knownKeys.has(`${r.verseId}|${r.page}`) && (r.TLW > 0 || r.BRW > 0));
  const multipage = rows.filter((r) => !knownKeys.has(`${r.verseId}|${r.page}`) && (byVerse.get(r.verseId)?.length ?? 0) > 1);
  const plain = rows.filter((r) => !knownKeys.has(`${r.verseId}|${r.page}`) && r.TLW === 0 && r.BRW === 0);
  const selectedMap = new Map<string, Row>();
  for (const row of allRows ? rows : [
    ...knownRows,
    ...random(notched, Math.ceil(sampleSize * 0.45)),
    ...random(multipage, Math.ceil(sampleSize * 0.30)),
    ...random(plain, Math.ceil(sampleSize * 0.25)),
  ]) selectedMap.set(`${row.verseId}|${row.page}`, row);
  // Content QA is verse-level, so include every fragment for every selected verse.
  for (const verseId of requestedVerseIds) {
    for (const row of byVerse.get(verseId) ?? []) selectedMap.set(`${row.verseId}|${row.page}`, row);
  }
  for (const verseId of new Set([...selectedMap.values()].map((r) => r.verseId))) {
    for (const row of byVerse.get(verseId) ?? []) selectedMap.set(`${row.verseId}|${row.page}`, row);
  }
  const selected = [...selectedMap.values()].filter((row) => requestedVerseIds.size === 0 || requestedVerseIds.has(row.verseId));

  const pageCache = new Map<number, OcrPage | null>();
  const imageCache = new Map<number, Awaited<ReturnType<typeof sharp.prototype.raw>> | any>();
  const loadOcr = (page: number) => {
    if (pageCache.has(page)) return pageCache.get(page)!;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(ocrRoot, version, `${String(page).padStart(3, '0')}.json`), 'utf8')) as OcrPage;
      pageCache.set(page, parsed);
      return parsed;
    } catch {
      pageCache.set(page, null);
      return null;
    }
  };
  const format = String((registry as any)?.format || 'jpg').trim() || 'jpg';
  const loadImage = async (page: number) => {
    if (imageCache.has(page)) return imageCache.get(page);
    const url = `${media}/fax/pages/${version}/${String(page).padStart(3, '0')}.${format}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const raw = await sharp(Buffer.from(await response.arrayBuffer())).greyscale().raw().toBuffer({ resolveWithObject: true });
    const threshold = pageThreshold(raw.data);
    const value = { ...raw, threshold };
    imageCache.set(page, value);
    return value;
  };

  const findings: any[] = [];
  for (const row of selected) {
    const imagePage = imagePageOf(row);
    const page = loadOcr(imagePage);
    if (!page?.lines?.length) {
      findings.push({ verseId: row.verseId, page: row.page, imagePage, known: known[row.verseId] ?? null, status: 'NO_OCR' });
      continue;
    }
    let image: any = null;
    try { image = await loadImage(imagePage); } catch {}
    const group = byVerse.get(row.verseId)!;
    const hasEarlier = group.some((r) => r.page < row.page);
    const hasLater = group.some((r) => r.page > row.page);
    const current = canon.get(row.verseId) ?? [];
    const next = canon.get(row.verseId + 1) ?? [];
    const top = nearestLine(page, row, 'top');
    const bottom = nearestLine(page, row, 'bottom');
    const flags: string[] = [];
    const proposals: Record<string, number> = {};
    const evidence: any = {};

    if (top && current.length) {
      const lineTokens = tokens(top.line.text);
      const prefix = findSequence(lineTokens, current) ?? findPrefixAcrossNextLine(page, top.line, current);
      const currentBoundaryPx = (row.X + row.TLW) / 700 * page.imgW;
      evidence.topLine = top.line.text;
      evidence.currentTlPx = Number(currentBoundaryPx.toFixed(1));
      if (prefix && prefix.index > 0) {
        const expectedPx = lexicalX(page, top.line, lineTokens[prefix.index]!.start);
        const avgChar = (top.rect.px.x1 - top.rect.px.x0) / Math.max(1, top.line.text.length);
        const profile = image ? gapProfile(image.data, image.info.width, image.info.height, top.rect.px, image.threshold.threshold) : null;
        const gap = profile ? chooseGap(profile.gaps, expectedPx, Math.max(24, avgChar * 3), 'left') : null;
        const proposedPx = gap?.mid ?? expectedPx;
        const proposedNorm = Math.round(proposedPx / page.imgW * 700 - row.X);
        proposals.TLW = Math.max(0, Math.min(row.W - 1, proposedNorm));
        evidence.tlExpectedPx = Number(expectedPx.toFixed(1));
        evidence.tlGap = gap && { mid: Number(gap.mid.toFixed(1)), width: gap.width, ink: Number(gap.ink.toFixed(3)) };
        evidence.tlResidualPx = Number(Math.abs(currentBoundaryPx - proposedPx).toFixed(1));
        evidence.tlCurrentInk = profileAt(profile!, currentBoundaryPx);
        if (Math.abs(currentBoundaryPx - proposedPx) > Math.max(8, avgChar * 1.2) ||
            (gap && !safelyInsideGap(currentBoundaryPx, gap)) ||
            (profile && (profileAt(profile, currentBoundaryPx) ?? 0) > 0.12)) flags.push('TL_NOT_IN_EXPECTED_WORD_GAP');
      } else if (hasEarlier && row.TLW > 0) {
        proposals.TLW = 0;
        proposals.TLH = 0;
        flags.push('FALSE_TL_PAGE_CONTINUATION_NOTCH');
      }
    }

    if (bottom && current.length) {
      const lineTokens = tokens(bottom.line.text);
      const suffix = findSuffixWithBoundaryContext(lineTokens, current, next);
      const currentBoundaryPx = (row.X + row.W - row.BRW) / 700 * page.imgW;
      evidence.bottomLine = bottom.line.text;
      evidence.currentBrPx = Number(currentBoundaryPx.toFixed(1));
      if (!suffix && hasLater && row.BRW > 0) {
        proposals.BRW = 0;
        proposals.BRH = 0;
        flags.push('FALSE_BR_PAGE_CONTINUATION_NOTCH');
      } else if (suffix) {
        const after = suffix.index + suffix.length;
        const nextPrefix = findSequence(lineTokens, next, after);
        if (nextPrefix && nextPrefix.index === after) {
          const leftToken = lineTokens[after - 1]!;
          const rightToken = lineTokens[after]!;
          const expectedPx = lexicalX(page, bottom.line, (leftToken.end + rightToken.start) / 2);
          const avgChar = (bottom.rect.px.x1 - bottom.rect.px.x0) / Math.max(1, bottom.line.text.length);
          const profile = image ? gapProfile(image.data, image.info.width, image.info.height, bottom.rect.px, image.threshold.threshold) : null;
          const gap = profile ? chooseGap(profile.gaps, expectedPx, Math.max(24, avgChar * 3)) : null;
          const proposedPx = gap?.mid ?? expectedPx;
          const proposedNorm = Math.round(row.X + row.W - proposedPx / page.imgW * 700);
          proposals.BRW = Math.max(0, Math.min(row.W - 1, proposedNorm));
          evidence.brExpectedPx = Number(expectedPx.toFixed(1));
          evidence.brGap = gap && { mid: Number(gap.mid.toFixed(1)), width: gap.width, ink: Number(gap.ink.toFixed(3)) };
          evidence.brResidualPx = Number(Math.abs(currentBoundaryPx - proposedPx).toFixed(1));
          evidence.brCurrentInk = profileAt(profile!, currentBoundaryPx);
          if (row.BRW === 0) flags.push('MISSING_BR_SAME_LINE_BOUNDARY');
          else if (Math.abs(currentBoundaryPx - proposedPx) > Math.max(8, avgChar * 1.2) ||
                   (gap && !safelyInsideGap(currentBoundaryPx, gap)) ||
                   (profile && (profileAt(profile, currentBoundaryPx) ?? 0) > 0.12)) flags.push('BR_NOT_IN_EXPECTED_WORD_GAP');
        } else if (after === lineTokens.length && row.BRW > 0) {
          proposals.BRW = 0;
          proposals.BRH = 0;
          flags.push('FALSE_BR_LINE_END_NOTCH');
        }
      }
    }

    const confidence = flags.length === 0 ? 'none'
      : Object.values(evidence).some((v: any) => v && typeof v === 'object' && v.width >= 3 && v.ink <= 0.08) ? 'high'
      : 'medium';
    const expectation = expectedByKey[`${row.verseId}|${row.page}`] ?? null;
    findings.push({
      verseId: row.verseId,
      page: row.page,
      imagePage,
      known: known[row.verseId] ?? null,
      row: { TLW: row.TLW, TLH: row.TLH, BRW: row.BRW, BRH: row.BRH },
      flags,
      confidence,
      proposals,
      evidence,
      expectation,
      expectationPassed: expectation
        ? expectation.shouldFlag
          ? flags.includes(expectation.code!)
          : flags.length === 0
        : null,
    });
  }

  const contentFindings: any[] = [];
  const selectedVerseIds = [...new Set(selected.map((r) => r.verseId))];
  for (const verseId of selectedVerseIds) {
    const canonical = canon.get(verseId) ?? [];
    const extracted: { text: string; line: string; page: number }[] = [];
    for (const row of byVerse.get(verseId) ?? []) {
      const imagePage = imagePageOf(row);
      const page = loadOcr(imagePage);
      if (!page) continue;
      extracted.push(...extractPolygonTokens(row, page).map((t) => ({ ...t, page: row.page, imagePage })));
    }
    const observed = extracted.map((t) => t.text);
    const pairs = fuzzyLcs(canonical, observed);
    const flags: string[] = [];
    let prefixLoss = 0, suffixLoss = 0, prefixLeak = 0, suffixLeak = 0;
    if (pairs.length >= 3) {
      prefixLoss = pairs[0]![0];
      suffixLoss = canonical.length - 1 - pairs.at(-1)![0];
      prefixLeak = pairs[0]![1];
      suffixLeak = observed.length - 1 - pairs.at(-1)![1];
      if (prefixLoss > 0) flags.push('CONTENT_PREFIX_LOSS');
      if (suffixLoss > 0) flags.push('CONTENT_SUFFIX_LOSS');
      if (prefixLeak > 0) flags.push('CONTENT_PREFIX_LEAK');
      if (suffixLeak > 0) flags.push('CONTENT_SUFFIX_LEAK');
    } else {
      flags.push('CONTENT_ALIGNMENT_LOW_ANCHOR');
    }
    const expectation = contentExpectations[verseId] ?? null;
    contentFindings.push({
      verseId,
      canonicalTokens: canonical.length,
      observedTokens: observed.length,
      matchedTokens: pairs.length,
      coverage: canonical.length ? Number((pairs.length / canonical.length).toFixed(3)) : 0,
      precision: observed.length ? Number((pairs.length / observed.length).toFixed(3)) : 0,
      prefixLoss, suffixLoss, prefixLeak, suffixLeak,
      flags,
      boundaryEvidence: {
        firstObserved: observed.slice(0, 8).join(' '),
        lastObserved: observed.slice(-8).join(' '),
        firstCanonical: canonical.slice(0, 8).join(' '),
        lastCanonical: canonical.slice(-8).join(' '),
      },
      expectation,
      expectationPassed: expectation
        ? expectation.shouldFlag
          ? flags.includes(expectation.code!)
          : flags.length === 0
        : null,
    });
  }

  const knownFindings = findings.filter((f) => f.known);
  const controlFindings = findings.filter((f) => !f.known);
  const report = {
    generatedAt: new Date().toISOString(),
    version,
    imageOffset,
    source: 'live bom_xtras_fax_index + canonical DB + Gemini OCR cache + scan pixels',
    selectedRows: selected.length,
    selectedPages: new Set(selected.map((r) => r.page)).size,
    known: {
      rows: knownFindings.length,
      flagged: knownFindings.filter((f) => f.flags?.length).length,
      cases: [...new Set(knownFindings.map((f) => f.known))],
      assertedRows: knownFindings.filter((f) => f.expectation).length,
      assertionsPassed: knownFindings.filter((f) => f.expectationPassed === true).length,
    },
    controls: {
      rows: controlFindings.length,
      flagged: controlFindings.filter((f) => f.flags?.length).length,
      highConfidence: controlFindings.filter((f) => f.confidence === 'high').length,
    },
    boundaryValidation: {
      assertedRows: findings.filter((f) => f.expectation).length,
      assertionsPassed: findings.filter((f) => f.expectationPassed === true).length,
    },
    flagCounts: findings.flatMap((f) => f.flags ?? []).reduce((m: Record<string, number>, k: string) => {
      m[k] = (m[k] ?? 0) + 1;
      return m;
    }, {}),
    contentValidation: {
      verses: contentFindings.length,
      flagged: contentFindings.filter((f) => f.flags.length).length,
      assertedVerses: contentFindings.filter((f) => f.expectation).length,
      assertionsPassed: contentFindings.filter((f) => f.expectationPassed === true).length,
      findings: contentFindings,
    },
    findings,
  };
  const json = JSON.stringify(report, null, 2);
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, json);
  }
  if (outFile) {
    console.log(JSON.stringify({
      out: outFile,
      version,
      selectedRows: report.selectedRows,
      selectedPages: report.selectedPages,
      boundaryAssertions: `${report.boundaryValidation.assertionsPassed}/${report.boundaryValidation.assertedRows}`,
      contentFindings: `${report.contentValidation.flagged}/${report.contentValidation.verses}`,
      flaggedRows: report.controls.flagged,
    }));
  } else console.log(json);
}

await main();
