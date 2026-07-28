#!/usr/bin/env -S /opt/homebrew/bin/node --import tsx
/**
 * Local fax render API backed only by the SQLite shadow database.
 *
 * It intentionally has no response cache and no rate limit: every request
 * reads current shadow rows, allowing a closed remediation/QA loop.
 */
import Fastify from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSelector } from '../src/media/fax/canonical.ts';
import { clampPages, sanitizeBoxes, toFragments } from '../src/media/fax/geometry.ts';
import { renderImage } from '../src/media/fax/render.ts';
import { selectorToVerseIds } from '../src/media/fax/resolve.ts';
import { fetchScan } from '../src/media/fax/scan.ts';
import {
  openShadow,
  shadowBoxes,
  shadowImageMeta,
  shadowMetadata,
  shadowVersions,
} from './lib/fax-shadow-db.ts';

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]! : fallback;
};
const shadowFile = path.resolve(flag('shadow', '.shadow/fax-shadow.sqlite'));
const mediaCache = path.resolve(flag('media-cache', '.shadow/media'));
const host = flag('host', '127.0.0.1');
const port = Number(flag('port', '8311'));
const db = openShadow(shadowFile);
const app = Fastify({ logger: false });
const versions = new Set(shadowVersions(db));
const scanInflight = new Map<string, Promise<Buffer>>();
fs.mkdirSync(mediaCache, { recursive: true });

async function cachedScan(
  version: string,
  page: number,
  format: string,
): Promise<Buffer> {
  const key = `${version}/${String(page).padStart(3, '0')}.${format}`;
  const file = path.join(mediaCache, key);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  let inflight = scanInflight.get(key);
  if (!inflight) {
    inflight = (async () => {
      const scan = await fetchScan(version, page, format);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, scan);
      return scan;
    })().finally(() => scanInflight.delete(key));
    scanInflight.set(key, inflight);
  }
  return inflight;
}

function parseWidth(value: string): number | 'full' | null {
  if (value === 'wfull') return 'full';
  const match = /^w(200|400|800|1600)$/.exec(value);
  return match ? Number(match[1]) : null;
}

app.get('/health', async () => ({
  ok: true,
  shadowFile,
  mediaCache,
  versions: versions.size,
  metadata: shadowMetadata(db),
}));

app.get('/fax/boxes/*', async (request, reply) => {
  const rest = (request.params as { '*': string })['*'];
  const [version, ...selectorParts] = rest.split('/');
  if (!version || !versions.has(version)) {
    return reply.code(400).send({ error: 'unknown version' });
  }
  const selector = selectorParts.join('/');
  const verseIds = selectorToVerseIds(selector);
  const meta = shadowImageMeta(db, version);
  const boxes = sanitizeBoxes(shadowBoxes(db, version, verseIds));
  return {
    pageScale: boxes[0]?.pageScale ?? 700,
    clamped: false,
    boxes: boxes.map((box) => ({
      verseId: box.verseId,
      imagePage: box.page + meta.offset,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      tlw: box.tlw,
      tlh: box.tlh,
      brw: box.brw,
      brh: box.brh,
    })),
  };
});

app.get('/fax/render/*', async (request, reply) => {
  const rest = (request.params as { '*': string })['*'];
  const parts = rest.split('/');
  if (parts.length < 4) return reply.code(400).send({ error: 'bad path' });
  const [version, mode, widthPart, ...selectorParts] = parts;
  if (!version || !versions.has(version)) {
    return reply.code(400).send({ error: 'unknown version' });
  }
  if (mode !== 'crop' && mode !== 'page') {
    return reply.code(400).send({ error: 'bad mode' });
  }
  const width = parseWidth(widthPart!);
  if (width == null) return reply.code(400).send({ error: 'bad width' });
  const selectorWithExtension = selectorParts.join('/');
  const dot = selectorWithExtension.lastIndexOf('.');
  if (dot < 0) return reply.code(400).send({ error: 'missing extension' });
  const selector = selectorWithExtension.slice(0, dot);
  const extension = selectorWithExtension.slice(dot + 1);
  if (extension !== 'jpg' && extension !== 'webp') {
    return reply.code(400).send({ error: 'bad extension' });
  }
  const verseIds = selectorToVerseIds(selector);
  if (!verseIds.length) return reply.code(404).send({ error: 'no verses' });
  const canonical = canonicalSelector(verseIds);
  if (canonical !== selector) {
    return reply.code(301)
      .header('location', `/fax/render/${version}/${mode}/${widthPart}/${canonical}.${extension}`)
      .send();
  }
  const boxes = sanitizeBoxes(shadowBoxes(db, version, verseIds));
  if (!boxes.length) return reply.code(404).send({ error: 'no boxes' });
  const { fragments } = clampPages(toFragments(boxes), 6);
  const meta = shadowImageMeta(db, version);
  const body = await renderImage({
    mode,
    ext: extension,
    width,
    fragments,
    paper: meta.paper,
    provider: (page) => cachedScan(version, page + meta.offset, meta.format),
  });
  return reply
    .header('content-type', extension === 'webp' ? 'image/webp' : 'image/jpeg')
    .header('cache-control', 'no-store')
    .send(body);
});

const close = async (): Promise<void> => {
  await app.close();
  db.close();
};
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());

await app.listen({ host, port });
console.log(JSON.stringify({ ready: true, host, port, shadowFile, mediaCache }));
