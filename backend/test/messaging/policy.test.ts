import { describe, expect, test } from 'vitest';
import {
  allowsRealtimeClientWrite,
  computeChannelCapabilities,
  projectChannelForViewer,
} from '../../src/messaging/policy.js';
import type { ChannelDTO } from '../../src/messaging/dto.js';

const flagship = (overrides: Partial<Parameters<typeof computeChannelCapabilities>[0]> = {}) =>
  computeChannelCapabilities({
    enabled: true,
    visibility: 'unlisted',
    membershipPolicy: 'fixed',
    rootPostPolicy: 'members',
    replyPolicy: 'authenticated',
    reactionPolicy: 'authenticated',
    authenticated: false,
    joined: false,
    banned: false,
    ...overrides,
  });

describe('fixed public study-group policy', () => {
  test('anonymous readers can read but cannot join or write', () => {
    expect(flagship()).toEqual({
      canRead: true, canJoin: false, canRequestMembership: false,
      canPostRoot: false, canReply: false, canReact: false,
    });
  });

  test('signed-in outsiders can reply/react but cannot join or root-post', () => {
    expect(flagship({ authenticated: true })).toEqual({
      canRead: true, canJoin: false, canRequestMembership: false,
      canPostRoot: false, canReply: true, canReact: true,
    });
  });

  test('joined members can root-post and disabled/banned policy fails closed', () => {
    expect(flagship({ authenticated: true, joined: true }).canPostRoot).toBe(true);
    expect(flagship({ authenticated: true, joined: true, banned: true })).toEqual({
      canRead: false, canJoin: false, canRequestMembership: false,
      canPostRoot: false, canReply: false, canReact: false,
    });
    expect(flagship({ authenticated: true, enabled: false })).toEqual({
      canRead: false, canJoin: false, canRequestMembership: false,
      canPostRoot: false, canReply: false, canReact: false,
    });
  });
});

test('non-member bots cannot bypass managed audience orchestration through realtime', () => {
  expect(allowsRealtimeClientWrite({ explicit: true, joined: false }, true)).toBe(false);
  expect(allowsRealtimeClientWrite({ explicit: true, joined: false }, false)).toBe(true);
  expect(allowsRealtimeClientWrite({ explicit: true, joined: true }, true)).toBe(true);
  expect(allowsRealtimeClientWrite({ explicit: false, joined: false }, true)).toBe(true);
});

test('public channel projection removes human roster and all presence', () => {
  const channel = {
    channel_url: 'c', name: 'n', cover_url: '', custom_type: 'public', description: '', data: '{}',
    metadata: null, member_count: 2, unread_message_count: 9, last_message: null, created_at: 1, lang: 'en',
    members: [
      { user_id: 'human', nickname: 'Human', profile_url: '', metadata: null, is_online: true, last_seen_at: 7, is_bot: false, role: 'member', state: 'joined', is_muted: false },
      { user_id: 'bot', nickname: 'Bot', profile_url: '', metadata: null, is_online: true, last_seen_at: 8, is_bot: true, role: 'member', state: 'joined', is_muted: false },
    ],
  } satisfies ChannelDTO;
  const projected = projectChannelForViewer(channel, { joined: false } as never);
  expect(projected.members.map((member) => member.user_id)).toEqual(['bot']);
  expect(projected.members[0]?.is_online).toBe(false);
  expect(projected.members[0]?.last_seen_at).toBeNull();
  expect(projected.unread_message_count).toBe(0);
});
