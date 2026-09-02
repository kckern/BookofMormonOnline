/**
 * Pure unit tests for toUserDTO profile-URL derivation (no DB).
 *
 * Profile images live at {base}/profiles/{user_id}.jpg. Under invariant I1
 * (docs/plans/2026-09-01-identity-avatar-consolidation.md) every human row's
 * user_id IS md5(bom_user.user) — the Sendbird-era handle rows that needed a
 * bom_user_id detour were merged away on 2026-09-02 — so the row key is the
 * image key for linked and unlinked rows alike.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { toUserDTO } from '../../src/messaging/users.js';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

const base = (row: Record<string, unknown>) => ({
  nickname: null,
  profile_url: null,
  metadata: null,
  is_bot: 0,
  last_seen_at: null,
  ...row,
});

describe('toUserDTO profile_url derivation', () => {
  it('derives from user_id for linked rows (user_id is md5(username) under I1)', () => {
    const hash = md5('someuser');
    const dto = toUserDTO(base({ user_id: hash, bom_user_id: 'someuser' }) as never);
    expect(dto.profile_url).toBe(`https://assets.bookofmormon.online/profiles/${hash}.jpg`);
  });

  it('derives from user_id for unlinked rows', () => {
    const hash = md5('otheruser');
    const dto = toUserDTO(base({ user_id: hash, bom_user_id: null }) as never);
    expect(dto.profile_url).toBe(`https://assets.bookofmormon.online/profiles/${hash}.jpg`);
  });

  it('never consults bom_user_id for the image key', () => {
    // A row that violates I1 would be refused by upsertUser; if one slipped
    // through, the DTO still keys the image by the row id rather than
    // re-deriving a second identity from the username.
    const dto = toUserDTO(base({ user_id: 'someuser_a1b2c3d4', bom_user_id: 'someuser' }) as never);
    expect(dto.profile_url).toBe('https://assets.bookofmormon.online/profiles/someuser_a1b2c3d4.jpg');
  });

  it('an explicitly stored profile_url always wins', () => {
    const dto = toUserDTO(
      base({
        user_id: 'x',
        bom_user_id: 'someone',
        profile_url: 'https://example.com/me.png',
      }) as never,
    );
    expect(dto.profile_url).toBe('https://example.com/me.png');
  });
});
