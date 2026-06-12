/**
 * Pure unit tests for toUserDTO profile-URL derivation (no DB).
 *
 * Profile images live at {base}/profiles/{md5(bom_user.user)}.jpg. Modern
 * human rows have user_id === md5(username), but SendBird-migrated legacy
 * rows carry handle-style ids ("stevenrushing_b5ef7fb8") — deriving from
 * user_id 404s for them. When the row is linked (bom_user_id = username),
 * derive from md5(username) instead.
 */

import { describe, expect, it } from 'vitest';
import { toUserDTO } from '../../src/messaging/users.js';

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
      base({ user_id: 'stevenrushing_b5ef7fb8', bom_user_id: 'stevenrushing' }) as never,
    );
    expect(dto.profile_url).toBe(
      'https://assets.bookofmormon.online/profiles/6472293c8df1b748d4287740fbbb4184.jpg',
    );
  });

  it('derives from user_id for unlinked rows (md5 ids unchanged)', () => {
    const dto = toUserDTO(
      base({ user_id: '34761c8d0e8bd7d64c00b3cd0684bf77', bom_user_id: null }) as never,
    );
    expect(dto.profile_url).toBe(
      'https://assets.bookofmormon.online/profiles/34761c8d0e8bd7d64c00b3cd0684bf77.jpg',
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
