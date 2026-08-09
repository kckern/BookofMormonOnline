import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('bom_user_token is only accessed via sessionStore', () => {
  it('no backend/src file except sessionStore.ts builds a bom_user_token query', () => {
    // Kysely references the table as a quoted string literal; prose comments use
    // the bare word. Match the quoted form so comments don't trip the guard.
    // `|| true` keeps grep's exit-1 (no matches) from throwing.
    const out = execSync(`grep -rl "'bom_user_token'" src || true`, { encoding: 'utf8' });
    const hits = out.split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((f) => f !== 'src/auth/sessionStore.ts');
    expect(hits, `unexpected direct bom_user_token query access in:\n${hits.join('\n')}`).toEqual([]);
  });
});
