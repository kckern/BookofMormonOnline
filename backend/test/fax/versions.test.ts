import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB so these are pure unit tests (no network). vi.hoisted lets the
// hoisted vi.mock factory reference the shared `execute` spy.
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../../src/data/db.js', () => ({
  getDb: () => ({
    selectFrom: () => ({ select: () => ({ distinct: () => ({ execute }) }) }),
  }),
}));

import {
  isRenderableVersion,
  renderableVersions,
  __clearVersionCache,
} from '../../src/media/fax/versions.js';

beforeEach(() => {
  __clearVersionCache();
  execute.mockReset();
});

describe('isRenderableVersion', () => {
  it('resolves versions present in bom_xtras_fax_index', async () => {
    execute.mockResolvedValue([{ version: '1837' }, { version: '1888d' }, { version: '1829' }]);
    expect(await isRenderableVersion('1837')).toBe(true);
    // 1888d + 1829 are the exact cases the hardcoded array got wrong / would miss.
    expect(await isRenderableVersion('1888d')).toBe(true);
    expect(await isRenderableVersion('1829')).toBe(true);
  });

  it('rejects a version that is not in the index', async () => {
    execute.mockResolvedValue([{ version: '1837' }]);
    expect(await isRenderableVersion('9999')).toBe(false);
  });

  it('rejects malformed input WITHOUT hitting the DB', async () => {
    execute.mockResolvedValue([{ version: '1837' }]);
    expect(await isRenderableVersion('../secret')).toBe(false);
    expect(await isRenderableVersion('')).toBe(false);
    expect(await isRenderableVersion('a'.repeat(21))).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not query per request — the set is cached across calls', async () => {
    execute.mockResolvedValue([{ version: '1837' }, { version: '1830' }]);
    await isRenderableVersion('1837');
    await isRenderableVersion('1830');
    await isRenderableVersion('1837');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent cold lookups into a single query', async () => {
    execute.mockResolvedValue([{ version: '1837' }]);
    await Promise.all([
      isRenderableVersion('1837'),
      isRenderableVersion('1830'),
      renderableVersions(),
    ]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('propagates DB errors so the caller can fail closed (503, not 400)', async () => {
    execute.mockRejectedValue(new Error('db down'));
    await expect(isRenderableVersion('1837')).rejects.toThrow('db down');
  });
});
