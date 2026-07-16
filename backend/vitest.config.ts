import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests query a remote live DB; module collection alone can
    // take 8-10 s on a cold vite transform cache.  Give hooks and individual
    // tests enough headroom so cold-cache runs don't produce false timeouts.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
