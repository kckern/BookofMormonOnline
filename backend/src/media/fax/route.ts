import type { FastifyInstance, FastifyReply } from 'fastify';
import { WIDTH_WHITELIST, MAX_PAGES, MAX_VERSE_IDS } from './constants.js';
import { isRenderableVersion } from './versions.js';
import { selectorToVerseIds, verseIdsToBoxes, legacyUnitToVerseIds, imageScanMeta } from './resolve.js';
import { toFragments, clampPages } from './geometry.js';
import { renderImage } from './render.js';
import { fetchScan } from './scan.js';
import { keyFor, coalesce, writeBack, withRenderSlot, legacyKey } from './cache.js';
import { canonicalSelector } from './canonical.js';
import { createHash } from 'node:crypto';

const etag = (b: Buffer) => `"${createHash('sha1').update(b).digest('hex')}"`;

/**
 * Gate a request on the version being renderable. Sends the error response and
 * returns false when it isn't: 400 for an unknown version (the caller's URL is
 * wrong — a cacheable, honest answer), 503 when the registry lookup itself fails
 * (DB down — not the caller's fault, and must not masquerade as a cacheable 400).
 */
async function ensureRenderable(reply: FastifyReply, version: string): Promise<boolean> {
  let ok: boolean;
  try {
    ok = await isRenderableVersion(version);
  } catch {
    reply.code(503).send({ error: 'version registry unavailable' });
    return false;
  }
  if (!ok) {
    reply.code(400).send({ error: 'unknown version' });
    return false;
  }
  return true;
}

function parseWidth(seg: string): number | 'full' | null {
  if (seg === 'wfull') return 'full';
  const m = /^w(\d+)$/.exec(seg);
  if (!m) return null;
  const n = Number(m[1]);
  return (WIDTH_WHITELIST as readonly number[]).includes(n) ? n : null;
}

export async function faxRoutes(app: FastifyInstance): Promise<void> {
  const rateLimit = (await import('@fastify/rate-limit')).default;
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.setErrorHandler((err, _req, reply) => {
    const code = (err as { statusCode?: number }).statusCode ?? 502;
    reply.code(code).send({ error: (err as Error).message });
  });

  // /fax/render/{version}/{mode}/w{width}/{selector...}.{ext}
  app.get('/fax/render/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*']; // version/mode/wNNN/selector.ext
    const parts = rest.split('/');
    if (parts.length < 4) return reply.code(400).send({ error: 'bad path' });
    const [version, mode, widthSeg, ...selParts] = parts;
    if (!(await ensureRenderable(reply, version!))) return reply;
    if (mode !== 'page' && mode !== 'crop') return reply.code(400).send({ error: 'bad mode' });
    const width = parseWidth(widthSeg!);
    if (width === null) return reply.code(400).send({ error: 'bad width' });

    const selRaw = selParts.join('/');
    const dot = selRaw.lastIndexOf('.');
    if (dot < 0) return reply.code(400).send({ error: 'missing ext' });
    const ext = selRaw.slice(dot + 1);
    const selector = selRaw.slice(0, dot);
    if (ext !== 'jpg' && ext !== 'webp') return reply.code(400).send({ error: 'bad ext' });

    const verseIds = selectorToVerseIds(selector);
    if (verseIds.length === 0) return reply.code(404).send({ error: 'no verses' });
    if (verseIds.length > MAX_VERSE_IDS) return reply.code(400).send({ error: 'too many verse ids' });

    // canonical redirect (manual Location for Fastify-version safety)
    const canonical = canonicalSelector(verseIds);
    if (canonical !== selector) {
      return reply.code(301)
        .header('cache-control', 'public, max-age=86400')
        .header('location', `/fax/render/${version}/${mode}/${widthSeg}/${canonical}.${ext}`)
        .send();
    }

    const key = keyFor({ version: version!, mode, width, selector, ext });
    try {
      const body = await coalesce(key, () => withRenderSlot(async () => {
        const boxes = await verseIdsToBoxes(version!, verseIds);
        if (boxes.length === 0) throw Object.assign(new Error('no boxes'), { statusCode: 404 });
        const { fragments, clamped } = clampPages(toFragments(boxes), MAX_PAGES);
        if (clamped) app.log.info({ key }, 'fax render clamped to N pages');
        const { offset, format, paper } = await imageScanMeta(version!);
        return renderImage({ mode, ext, width, fragments, paper, provider: (p) => fetchScan(version!, p + offset, format) });
      }));
      writeBack(key, body, ext);
      return reply
        .header('content-type', ext === 'webp' ? 'image/webp' : 'image/jpeg')
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('etag', etag(body))
        .send(body);
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 502).send({ error: (err as Error).message });
    }
  });

  // Legacy: /fax/text/{version}/{slug}-{id}(.jpg) -> mode=page, width=full
  app.get('/fax/text/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*'];
    const parts = rest.split('/');
    if (parts.length < 2) return reply.code(400).send({ error: 'bad path' });
    const version = parts[0]!;
    if (!(await ensureRenderable(reply, version))) return reply;
    const tail = parts.slice(1).join('/').replace(/\.jpg$/, '');
    const m = /^([a-z-]{1,50})-(\d{1,6})$/.exec(tail);
    if (!m) return reply.code(400).send({ error: 'bad unit' });
    const slug = m[1]!, id = Number(m[2]);

    const verseIds = await legacyUnitToVerseIds(slug, id);
    if (verseIds.length === 0) return reply.code(404).send({ error: 'unresolved unit' });

    const key = legacyKey(version, slug, id);
    try {
      const body = await coalesce(key, () => withRenderSlot(async () => {
        const boxes = await verseIdsToBoxes(version, verseIds);
        if (boxes.length === 0) throw Object.assign(new Error('no boxes'), { statusCode: 404 });
        const { fragments } = clampPages(toFragments(boxes), MAX_PAGES);
        const { offset, format, paper } = await imageScanMeta(version);
        return renderImage({ mode: 'page', ext: 'jpg', width: 'full', fragments, paper, provider: (p) => fetchScan(version, p + offset, format) });
      }));
      writeBack(key, body, 'jpg');
      return reply
        .header('content-type', 'image/jpeg')
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('etag', etag(body))
        .send(body);
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 502).send({ error: (err as Error).message });
    }
  });

  // Box coordinates for a passage — JSON for the viewer's DOM highlight overlay.
  // GET /fax/boxes/{version}/{selector}  ->  { pageScale, clamped, boxes: [{ verseId, imagePage, x, y, w, h, tlw, tlh, brw, brh }] }
  // tlw/tlh = top-left notch (verse starts mid-line), brw/brh = bottom-right notch
  // (verse ends mid-line). 0 when the box is a plain rectangle. Consumers use them
  // to draw notched cutout polygons and to decide when a verse crop needs the
  // render API (notched/multi-box) vs a plain CSS crop.
  app.get('/fax/boxes/*', async (req, reply) => {
    const rest = (req.params as { '*': string })['*']; // version/selector...
    const parts = rest.split('/');
    if (parts.length < 2) return reply.code(400).send({ error: 'bad path' });
    const version = parts[0]!;
    if (!(await ensureRenderable(reply, version))) return reply;
    const selector = parts.slice(1).join('/');

    const verseIds = selectorToVerseIds(selector);
    if (verseIds.length === 0) {
      return reply.header('cache-control', 'public, max-age=86400').send({ pageScale: 700, clamped: false, boxes: [] });
    }
    const clamped = verseIds.length > MAX_VERSE_IDS;
    const ids = clamped ? verseIds.slice(0, MAX_VERSE_IDS) : verseIds;

    const boxes = await verseIdsToBoxes(version, ids);
    const out = boxes.map((b) => ({
      verseId: b.verseId,
      // b.page is the scan image-file number — the same canonical number used
      // by the viewer's leaf.pageNumInt. `meta.offset` is needed when fetching
      // a rendered source scan, but applying it here made the DOM-overlay join
      // miss every non-zero-offset edition.
      imagePage: b.page,
      x: b.x, y: b.y, w: b.w, h: b.h,
      tlw: b.tlw, tlh: b.tlh, brw: b.brw, brh: b.brh,
    }));
    const pageScale = boxes[0]?.pageScale ?? 700;
    return reply
      .header('cache-control', 'public, max-age=86400')
      .send({ pageScale, clamped, boxes: out });
  });
}
