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
