import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { faxRoutes } from '../../src/media/fax/route.js';

async function app() {
  const f = Fastify();
  await f.register(faxRoutes);
  return f;
}

describe('GET /fax/render', () => {
  it('rejects an unknown version with 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/9999/crop/w400/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(400);
  });
  it('rejects a bad width with 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/1837/crop/w123/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(400);
  });
  it('renders a real verse to a JPEG (integration)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/1837/crop/w400/1-nephi-1.1.jpg' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
    expect(r.rawPayload.length).toBeGreaterThan(1000);
  });
});

describe('GET /fax/text (legacy alias)', () => {
  it('renders ammon-132 to a JPEG (integration)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/text/1837/ammon-132' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/jpeg');
  });
  it('404s a topical-heading unit', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/text/1837/lehites-83' });
    expect(r.statusCode).toBe(404);
  });
});

describe('GET /fax/render canonical redirect', () => {
  it('301-redirects a non-canonical ids/ selector to the ref slug', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/render/1837/crop/w400/ids/31103.jpg' });
    expect(r.statusCode).toBe(301);
    expect(r.headers['location']).toContain('/fax/render/1837/crop/w400/1-nephi-1.1.jpg');
  });
});

describe('GET /fax/boxes', () => {
  it('returns imagePage (fax page + offset) + coords for a known verse', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/2013/mosiah-4.21' });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body) as {
      pageScale: number; clamped: boolean;
      boxes: { verseId: number; imagePage: number; x: number; y: number; w: number; h: number }[];
    };
    expect(body.pageScale).toBe(700);
    expect(body.boxes.length).toBeGreaterThan(0);
    const b = body.boxes[0]!;
    expect(b.imagePage).toBe(156);   // 2013 fax page 165 + offset (-9)
    expect(b.x).toBe(357);
    expect(b.y).toBe(291);
  });
  it('unknown verse -> empty boxes (200)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/2013/ids/999999' });
    expect(r.statusCode).toBe(200);
    expect((JSON.parse(r.body) as { boxes: unknown[] }).boxes).toEqual([]);
  });
  it('unknown version -> 400', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/9999/mosiah-4.21' });
    expect(r.statusCode).toBe(400);
  });
  // Regression: editions loaded into bom_xtras_fax_index AFTER the old hardcoded
  // VERSION_SLUGS array (e.g. 1888d) must resolve, not 400 — no code change.
  // Uses /boxes so it exercises the version gate without needing a scan fetch.
  it('a DB-registered version absent from the old hardcoded list resolves (not 400)', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/fax/boxes/1888d/ether-12.39' });
    expect(r.statusCode).toBe(200);
  });
});
