/**
 * test/migrations/mergeLegacyUsers.test.ts
 *
 * Planner for docs/plans/2026-09-01-identity-avatar-consolidation.md Task 1.1.
 *
 * The merge migration folds Sendbird-era handle rows (`caspianrex`,
 * `caspianrex_d540bc18`) into the md5 row the current backend writes to.
 * Every child FK on prod is ON DELETE CASCADE, so the planner must be the
 * thing that is provably right: it may never invent a target row, and it may
 * never touch bots or unlinked humans.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { planMerge } from '../../migrations/2026-09-02-merge-legacy-messenger-users.mjs';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

describe('planMerge', () => {
  it('maps every legacy human row onto its md5 sibling and never onto itself', () => {
    const rows = [
      { user_id: md5('caspianrex'), bom_user_id: 'caspianrex', is_bot: 0 },
      { user_id: 'caspianrex', bom_user_id: 'caspianrex', is_bot: 0 },
      { user_id: 'caspianrex_d540bc18', bom_user_id: 'caspianrex', is_bot: 0 },
    ];
    const plan = planMerge(rows);
    expect(plan.moves).toEqual([
      { from: 'caspianrex', to: md5('caspianrex') },
      { from: 'caspianrex_d540bc18', to: md5('caspianrex') },
    ]);
    expect(plan.deleteOrphans).toEqual([]);
  });

  it('refuses a legacy row whose md5 sibling is missing (never invents a target)', () => {
    const rows = [{ user_id: 'orphan', bom_user_id: 'ghost', is_bot: 0 }];
    expect(() => planMerge(rows)).toThrow(/no md5 sibling for ghost/);
  });

  it('leaves bots and unlinked rows alone, and lists test_ fixtures for deletion', () => {
    const rows = [
      { user_id: 'welcome_bot', bom_user_id: null, is_bot: 1 },
      { user_id: 'legacy_bot_handle', bom_user_id: 'somebody', is_bot: 1 },
      { user_id: md5('somebody'), bom_user_id: 'somebody', is_bot: 0 },
      { user_id: 'test_u_abc', bom_user_id: null, is_bot: 0 },
      { user_id: 'stray_human_handle', bom_user_id: null, is_bot: 0 },
    ];
    const plan = planMerge(rows);
    expect(plan.moves).toEqual([]);
    expect(plan.deleteOrphans).toEqual(['test_u_abc']);
    expect(plan.leftAlone).toEqual(['stray_human_handle']);
  });

  it('treats an md5 row as already canonical even when is_bot is null', () => {
    const rows = [{ user_id: md5('x'), bom_user_id: 'x', is_bot: null }];
    expect(planMerge(rows)).toEqual({ moves: [], deleteOrphans: [], leftAlone: [] });
  });

  it('is case-insensitive about the md5 shape but exact about the target', () => {
    const rows = [
      { user_id: md5('y').toUpperCase(), bom_user_id: 'y', is_bot: 0 },
      { user_id: 'y_legacy', bom_user_id: 'y', is_bot: 0 },
    ];
    // The sibling exists only in upper case; MySQL compares case-insensitively
    // but the planner must still find it rather than throw.
    expect(planMerge(rows).moves).toEqual([{ from: 'y_legacy', to: md5('y') }]);
  });
});
