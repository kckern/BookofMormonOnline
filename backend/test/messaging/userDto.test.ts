/**
 * Pure unit tests for toUserDTO profile-URL derivation (no DB).
 *
 * Profile images live at {base}/profiles/{md5(bom_user.user)}.jpg. Modern
 * human rows have user_id === md5(username), but SendBird-migrated legacy
 * rows carry handle-style ids ("someuser_a1b2c3d4") — deriving from
 * user_id 404s for them. When the row is linked (bom_user_id = username),
 * derive from md5(username) instead.
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
  it('derives from md5(bom_user_id) for linked legacy rows', () => {
    const dto = toUserDTO(
      base({ user_id: 'someuser_a1b2c3d4', bom_user_id: 'someuser' }) as never,
    );
    expect(dto.profile_url).toBe(
      `https://assets.bookofmormon.online/profiles/${md5('someuser')}.jpg`,
    );
  });

  it('derives from user_id for unlinked rows (md5 ids unchanged)', () => {
    const hash = md5('otheruser');
    const dto = toUserDTO(base({ user_id: hash, bom_user_id: null }) as never);
    expect(dto.profile_url).toBe(
      `https://assets.bookofmormon.online/profiles/${hash}.jpg`,
    );
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
