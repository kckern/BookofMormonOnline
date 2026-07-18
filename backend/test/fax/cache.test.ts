import { describe, it, expect, vi } from 'vitest';
import { keyFor, coalesce, _resetInFlight } from '../../src/media/fax/cache.js';

describe('keyFor', () => {
  it('derives the render S3 key from the canonical path parts', () => {
    expect(keyFor({ version: '1837', mode: 'crop', width: 400, selector: '1-nephi-1.1', ext: 'jpg' }))
      .toBe('fax/render/1837/crop/w400/1-nephi-1.1.jpg');
  });
  it('uses wfull for full width', () => {
    expect(keyFor({ version: '1837', mode: 'page', width: 'full', selector: 'ids/31103', ext: 'jpg' }))
      .toBe('fax/render/1837/page/wfull/ids/31103.jpg');
  });
});

describe('coalesce', () => {
  it('runs one producer for concurrent identical keys', async () => {
    _resetInFlight();
    const producer = vi.fn(async () => Buffer.from('x'));
    const [a, b] = await Promise.all([coalesce('k', producer), coalesce('k', producer)]);
    expect(producer).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

import { withRenderSlot } from '../../src/media/fax/cache.js';
describe('withRenderSlot', () => {
  it('bounds concurrency (never exceeds the cap)', async () => {
    let active = 0, peak = 0;
    const job = () => withRenderSlot(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--; return 1;
    });
    await Promise.all(Array.from({ length: 20 }, job));
    expect(peak).toBeLessThanOrEqual(Number(process.env.FAX_MAX_RENDERS ?? 4));
  });
});
