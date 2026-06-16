import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { getSearchConfig } from '../../src/search/config.js';

const KEYS = ['SEARCH_BACKEND', 'QDRANT_URL', 'QDRANT_API_KEY', 'SEARCH_EMBED_MODEL'];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe('getSearchConfig', () => {
  test('defaults: backend=like, default url + model, no key', () => {
    const c = getSearchConfig();
    expect(c.backend).toBe('like');
    expect(c.qdrantUrl).toBe('http://127.0.0.1:6333');
    expect(c.embedModel).toBe('text-embedding-3-small');
    expect(c.qdrantApiKey).toBeUndefined();
  });

  test('reads overrides from env', () => {
    process.env.SEARCH_BACKEND = 'qdrant';
    process.env.QDRANT_URL = 'http://qdrant:6333';
    process.env.QDRANT_API_KEY = 'secret';
    process.env.SEARCH_EMBED_MODEL = 'text-embedding-3-large';
    const c = getSearchConfig();
    expect(c).toEqual({ backend: 'qdrant', qdrantUrl: 'http://qdrant:6333', qdrantApiKey: 'secret', embedModel: 'text-embedding-3-large' });
  });

  test('unknown SEARCH_BACKEND falls back to like', () => {
    process.env.SEARCH_BACKEND = 'bogus';
    expect(getSearchConfig().backend).toBe('like');
  });
});
