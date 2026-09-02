import type { Kysely, Selectable } from 'kysely';
import type { DB } from '../../codegen/db.js';
import type { ChannelDTO } from './dto.js';
import { getMembership } from './members.js';
import { getBus } from '../realtime/RealtimeBus.js';

export type AudiencePolicy = 'members' | 'authenticated' | 'nobody';
export type MembershipPolicy = 'open' | 'request' | 'fixed';
export type ChannelVisibility = 'private' | 'public' | 'unlisted';

export interface ChannelAccess {
  exists: boolean;
  channelUrl: string;
  customType: string | null;
  explicit: boolean;
  enabled: boolean;
  listed: boolean;
  visibility: ChannelVisibility;
  membershipPolicy: MembershipPolicy;
  rootPostPolicy: AudiencePolicy;
  replyPolicy: AudiencePolicy;
  reactionPolicy: AudiencePolicy;
  ownerUserId: string | null;
  authenticated: boolean;
  joined: boolean;
  operator: boolean;
  banned: boolean;
  canRead: boolean;
  canJoin: boolean;
  canRequestMembership: boolean;
  canPostRoot: boolean;
  canReply: boolean;
  canReact: boolean;
}

function audienceAllows(policy: AudiencePolicy, authenticated: boolean, joined: boolean): boolean {
  if (policy === 'nobody') return false;
  return policy === 'members' ? joined : authenticated;
}

function isMissingPolicyTable(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  return candidate?.code === 'ER_NO_SUCH_TABLE' || candidate?.errno === 1146;
}

export function computeChannelCapabilities(input: {
  enabled: boolean;
  visibility: ChannelVisibility;
  membershipPolicy: MembershipPolicy;
  rootPostPolicy: AudiencePolicy;
  replyPolicy: AudiencePolicy;
  reactionPolicy: AudiencePolicy;
  authenticated: boolean;
  joined: boolean;
  banned: boolean;
}): Pick<ChannelAccess, 'canRead' | 'canJoin' | 'canRequestMembership' | 'canPostRoot' | 'canReply' | 'canReact'> {
  const publicReadable = input.enabled && (input.visibility === 'public' || input.visibility === 'unlisted');
  return {
    canRead: !input.banned && input.enabled && (input.joined || publicReadable),
    canJoin: !input.banned && input.enabled && input.authenticated && input.membershipPolicy === 'open',
    canRequestMembership: !input.banned && input.enabled && input.authenticated && input.membershipPolicy === 'request',
    canPostRoot: !input.banned && input.enabled && audienceAllows(input.rootPostPolicy, input.authenticated, input.joined),
    canReply: !input.banned && input.enabled && audienceAllows(input.replyPolicy, input.authenticated, input.joined),
    canReact: !input.banned && input.enabled && audienceAllows(input.reactionPolicy, input.authenticated, input.joined),
  };
}

/**
 * Explicit-policy audience bots are server-orchestrated identities, not public
 * socket clients. Human outsiders may use authenticated reply/reaction policy;
 * non-member bots must enter only through the managed discussion queue.
 */
export function allowsRealtimeClientWrite(
  access: Pick<ChannelAccess, 'explicit' | 'joined'>,
  actorIsBot: boolean,
): boolean {
  return !access.explicit || access.joined || !actorIsBot;
}

/**
 * The single authorization decision for messenger channels. Explicit policy
 * rows opt a channel into the new model; channels without one keep their exact
 * legacy custom_type semantics.
 */
export async function getChannelAccess(
  db: Kysely<DB>,
  channelUrl: string,
  userId?: string | null,
): Promise<ChannelAccess> {
  const channel = await db.selectFrom('messenger_channels')
    .select(['channel_url', 'custom_type'])
    .where('channel_url', '=', channelUrl)
    .executeTakeFirst();

  const empty: ChannelAccess = {
    exists: false, channelUrl, customType: null, explicit: false, enabled: false,
    listed: false, visibility: 'private', membershipPolicy: 'fixed',
    rootPostPolicy: 'members', replyPolicy: 'members', reactionPolicy: 'members',
    ownerUserId: null, authenticated: !!userId, joined: false, operator: false,
    banned: false, canRead: false, canJoin: false, canRequestMembership: false,
    canPostRoot: false, canReply: false, canReact: false,
  };
  if (!channel) return empty;

  const membership = userId ? await getMembership(db, channelUrl, userId) : null;
  const joined = membership?.state === 'joined';
  const banned = membership?.state === 'banned';
  const operator = joined && membership?.role === 'operator';

  let policy: Selectable<DB['messenger_channel_policy']> | undefined;
  try {
    policy = await db.selectFrom('messenger_channel_policy').selectAll()
      .where('channel_url', '=', channelUrl).executeTakeFirst();
  } catch (error) {
    // Only the known rolling-deploy case (migration not landed yet) retains
    // legacy semantics. Every other policy read failure denies access.
    if (!isMissingPolicyTable(error)) {
      return { ...empty, exists: true, channelUrl, customType: channel.custom_type };
    }
    if (process.env['NODE_ENV'] !== 'test') {
      console.warn('[messenger-policy] policy table unavailable; using legacy policy');
    }
  }

  const explicit = !!policy;
  const legacyPublic = channel.custom_type === 'public' || channel.custom_type === 'open';
  const visibility: ChannelVisibility = policy?.visibility ?? (legacyPublic ? 'public' : 'private');
  const membershipPolicy: MembershipPolicy = policy?.membership_policy
    ?? (channel.custom_type === 'open' ? 'open' : channel.custom_type === 'public' ? 'request' : 'fixed');
  const rootPostPolicy: AudiencePolicy = policy?.root_post_policy ?? 'members';
  const replyPolicy: AudiencePolicy = policy?.reply_policy ?? 'members';
  const reactionPolicy: AudiencePolicy = policy?.reaction_policy ?? 'members';
  const enabled = policy ? policy.enabled === 1 : true;
  const authenticated = !!userId;
  const capabilities = computeChannelCapabilities({
    enabled, visibility, membershipPolicy, rootPostPolicy, replyPolicy,
    reactionPolicy, authenticated, joined, banned,
  });

  return {
    exists: true,
    channelUrl,
    customType: channel.custom_type,
    explicit,
    enabled,
    listed: policy ? policy.listed === 1 : true,
    visibility,
    membershipPolicy,
    rootPostPolicy,
    replyPolicy,
    reactionPolicy,
    ownerUserId: policy?.owner_user_id ?? null,
    authenticated,
    joined,
    operator,
    banned,
    ...capabilities,
  };
}

/** Public readers see bot identities, never private human roster/presence. */
export function projectChannelForViewer(channel: ChannelDTO, access: ChannelAccess): ChannelDTO {
  if (access.joined) return channel;
  const members = channel.members
    .filter((member) => member.is_bot)
    .map((member) => ({ ...member, is_online: false, last_seen_at: null }));
  return { ...channel, members, member_count: members.length, unread_message_count: 0 };
}

export async function isThreadLocked(
  db: Kysely<DB>,
  channelUrl: string,
  rootMessageId: string,
): Promise<boolean> {
  try {
    const state = await db.selectFrom('messenger_thread_state')
      .select(['channel_url', 'status'])
      .where('root_message_id', '=', rootMessageId)
      .executeTakeFirst();
    return !!state && (state.channel_url !== channelUrl || state.status === 'locked');
  } catch (error) {
    return !isMissingPolicyTable(error);
  }
}

export const publicChannelRoom = (channelUrl: string): string => `public:${channelUrl}`;

export function emitPublicChannelEvent(event: string, channelUrl: string, payload: unknown): void {
  getBus().emit(event, channelUrl, payload);
  getBus().emit(event, publicChannelRoom(channelUrl), payload);
}
