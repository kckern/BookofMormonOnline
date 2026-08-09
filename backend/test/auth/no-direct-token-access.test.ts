import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Resolve backend/src relative to THIS file so the guard-rail can't silently
// pass when run from an unexpected cwd (a guard-rail that quietly no-ops is
// worse than none).
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');

describe('bom_user_token is only accessed via sessionStore', () => {
  it('no backend/src file except sessionStore.ts builds a bom_user_token query', () => {
    // Kysely references the table as a quoted string literal; prose comments use
    // the bare word. Match the quoted form so comments don't trip the guard.
    // `|| true` keeps grep's exit-1 (no matches) from throwing — a zero-match
    // then fails the sanity assertion below with a clear message.
    const out = execSync(`grep -rl "'bom_user_token'" . || true`, { cwd: srcDir, encoding: 'utf8' });
    const hits = out
      .split('\n')
      .map((s) => s.trim().replace(/^\.\//, ''))
      .filter(Boolean);

    // Sanity: the one authorized site must appear — otherwise the grep ran
    // against the wrong tree and an empty result would be a false pass.
    expect(hits, 'guard-rail found no bom_user_token at all — wrong srcDir?').toContain(
      'auth/sessionStore.ts',
    );

    const unauthorized = hits.filter((f) => f !== 'auth/sessionStore.ts');
    expect(
      unauthorized,
      `unexpected direct bom_user_token query access in:\n${unauthorized.join('\n')}`,
    ).toEqual([]);
  });
});
