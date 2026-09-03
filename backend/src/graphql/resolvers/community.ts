/**
 * community/messaging read resolvers — P3 of the green-field messaging platform.
 * See docs/specs/2026-06-09-greenfield-messaging-platform.md (Task 3.1).
 *
 * Implements the five read queries:
 *   loadGroupsFromHash  — bom_shortlinks hash[] → channels → [StudyGroup]
 *   homefeed            — featured + user channels, feed algorithm → HomeFeed
 *   homethread          — thread replies for a message → [HomeFeedItem]
 *   homegroups          — user + featured channels → [HomeGroup]
 *   requestedUsers      — pending join-requests on a channel → [HomeUser]
 *
 * Token resolution: token arg → bom_user_token join → bom_user.user → md5() = messenger user_id.
 * Uses messaging services (channels/members/messages/users) from backend/src/messaging/.
 * No Sequelize; no legacy imports.
 */
import type { Resolvers } from '../../../codegen/graphql.js';
import type { AppContext } from '../context.js';
import { md5, genUserAvatar } from '../../auth/identity.js';
import { resolveUsername as resolveUsernameByToken } from '../../auth/sessionStore.js';
import { getChannel, getMyStudyGroups, getPublicChannels } from '../../messaging/channels.js';
import { getChannelMembers, addUserToChannel, deleteMembershipRowInState, getPublicUserIds, isUserBanned } from '../../messaging/members.js';
import { getMessage, getMessages, getMessagesForChannels, getThread } from '../../messaging/messages.js';
import { getUser, getUsers, listStudyBots } from '../../messaging/users.js';
import { addBotToChannel, removeBotFromChannel } from '../../messaging/bots/registry.js';
import type { ChannelDTO, MessageDTO, UserDTO } from '../../messaging/dto.js';
import { getBus } from '../../realtime/RealtimeBus.js';
import { isDuplicateKeyError } from '../../data/errors.js';
import { loadReadingPlan } from '../../messaging/readingplan.js';
import { getChannelAccess, projectChannelForViewer } from '../../messaging/policy.js';

// ─── Token → messenger user_id ───────────────────────────────────────────────

/**
 * Resolve a GraphQL token arg to the messenger user_id (md5 of bom_user.user).
 * Returns null when the token is absent or unknown.
 */
async function resolveMessengerUserId(ctx: AppContext, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const username = await resolveUsernameByToken(ctx.db, token);
  if (!username) return null;
  return md5(username);
}

/**
 * Resolve a token to the bom_user.user it belongs to (the raw username used to
 * score bom_log credit). Falls back to the token itself for anon users, who log
 * progress under their token — matches legacy readingplan queryBy.
 */
async function resolveUsername(ctx: AppContext, token: string | null | undefined): Promise<string> {
  if (!token) return '';
  const username = await resolveUsernameByToken(ctx.db, token);
  return username ?? token;
}

// ─── HomeUser shape assembly ──────────────────────────────────────────────────

/**
 * Assemble a HomeUser GQL object from a UserDTO + optional bom_user progress row.
 *
 * HomeUser SDL fields:
 *   user_id, nickname, picture, progress, finished, lastseen, laststudied,
 *   bookmark, public, isBot
 *
 * progress / finished / lastseen come from bom_user when available (same as
 * legacy loadHomeUser); picture falls back to the neutral thumbs avatar.
 */
interface BomUserProgress {
  user: string;
  complete: string | number | null;
  finished: number | null;
  last_active: number | null;
}

/**
 * Default avatar for a user with no usable profile image. Uses the canonical
 * neutral `thumbs` generator (genUserAvatar) — NOT dicebear `personas`, which
 * produces gendered avatars (facial hair, hairstyles) and is not acceptable for
 * an unknown/anonymized user. Deterministic per user_id.
 */
function defaultAvatar(userId: string): string {
  return genUserAvatar(userId || 'user');
}

function assembleHomeUser(
  userDto: UserDTO | null,
  progress?: BomUserProgress | null,
): Record<string, unknown> {
  // Derive user_id: prefer userDto, fall back to md5 of bom username
  const user_id = userDto?.user_id ?? (progress ? md5(progress.user) : null);

  // Dead-host guard: avatars.dicebear.com (dicebear v1) was decommissioned and
  // now returns 410 Gone. Sendbird-migrated profile_urls still point at it for
  // ~50 users. Treat those as empty so they fall back to a working avatar rather
  // than render broken. (Live Sendbird-hosted images are left alone — they work
  // until Sendbird is shut down; re-hosting them is a separate migration job.)
  const rawProfile = userDto?.profile_url;
  const isDeadProfile = !!rawProfile && /avatars\.dicebear\.com\//.test(rawProfile);
  const picture = (rawProfile && !isDeadProfile) ? rawProfile : defaultAvatar(user_id ?? 'user');

  // Parse metadata from the messenger user (summary/bookmark packed as JSON strings)
  let summary: { completed?: number; finished?: number[] } = {};
  let bookmark: { latest?: number; slug?: string | null; pagetitle?: string | null; heading?: string | null } = {};

  if (userDto?.metadata) {
    try {
      const raw = userDto.metadata as Record<string, unknown>;
      if (typeof raw['summary'] === 'string') {
        summary = JSON.parse(raw['summary']) as typeof summary;
      } else if (raw['summary'] && typeof raw['summary'] === 'object') {
        summary = raw['summary'] as typeof summary;
      }
    } catch { /* ignore parse error */ }
    try {
      const raw = userDto.metadata as Record<string, unknown>;
      if (typeof raw['bookmark'] === 'string') {
        bookmark = JSON.parse(raw['bookmark']) as typeof bookmark;
      } else if (raw['bookmark'] && typeof raw['bookmark'] === 'object') {
        bookmark = raw['bookmark'] as typeof bookmark;
      }
    } catch { /* ignore parse error */ }
  }

  const isBot = !!(
    (userDto?.metadata as Record<string, unknown> | null)?.['isBot'] ||
    (userDto?.is_bot) ||
    /🟢/.test(userDto?.nickname ?? '')
  );
  let nickname = userDto?.nickname ?? progress?.user ?? 'User';
  if (isBot) nickname = nickname.replace(/🟢/g, '').trim();

  // Progress: from bom_user.complete (percent, 0-100 scale) or messenger summary
  const progressVal =
    progress?.complete !== undefined && progress?.complete !== null
      ? parseFloat(String(progress.complete))
      : (summary?.completed ?? 0);

  // Finished: bom_user.finished (unix timestamp array) or summary
  let finished: number[] = [];
  if (progress?.finished != null) {
    finished = Array.isArray(progress.finished) ? progress.finished : [progress.finished];
  } else if (summary?.finished) {
    finished = Array.isArray(summary.finished) ? summary.finished : [summary.finished];
  }

  const lastseen = bookmark?.latest ?? progress?.last_active ?? userDto?.last_seen_at ?? 0;
  const laststudied =
    bookmark?.heading
      ? `${bookmark.heading}${bookmark.pagetitle ? ` (${bookmark.pagetitle})` : ''}`
      : null;
  const bookmarkSlug = bookmark?.slug ?? null;

  return {
    user_id,
    nickname,
    picture,
    progress: progressVal,
    finished,
    lastseen,
    laststudied,
    bookmark: bookmarkSlug,
    public: false, // privacy determination requires cross-table lookup; default to false per legacy
    isBot,
  };
}

// ─── Privacy masking (legacy maskNickname / maskUserPrivacy) ──────────────────

/** Anonymize a nickname: first letter + block glyphs, keeping first/last 2 chars. */
function maskNickname(nickname: string): string {
  if (nickname.length < 4) return nickname.charAt(0).toUpperCase() + '██';
  let masked = nickname.replace(/^(.{2}).*(.{2})$/, '$1████$2');
  masked = masked.charAt(0).toUpperCase() + masked.slice(1);
  return masked;
}

/**
 * Mask a HomeUser for a non-public account: anonymize nickname + picture so a
 * private user never surfaces by name on a public surface (e.g. leaderboard).
 * Public users (`public: true`) pass through untouched. Mirrors legacy
 * maskUserPrivacy (BomCommunity.ts:67).
 *
 * Bots are never masked: a bot persona's display name (e.g. "Henry VIII") IS
 * the content, not private user data, so anonymizing it is nonsensical.
 */
function maskUserPrivacy(u: Record<string, unknown>): Record<string, unknown> {
  if (u.public || u.isBot) return u;
  const seed = (u.user_id as string) || 'user';
  return {
    ...u,
    nickname: maskNickname((u.nickname as string) ?? 'User'),
    picture: defaultAvatar(seed),
  };
}

// ─── HomeFeedItem shape assembly ──────────────────────────────────────────────

/**
 * Assemble a HomeFeedItem GQL object from a MessageDTO.
 * Mirrors legacy loadHomeItem() exactly: parses data JSON for links/highlights,
 * prepends custom_type (pageSlug) to text/section/fax link values.
 */
function assembleHomeFeedItem(msg: MessageDTO, publicUserIds?: Set<string>): Record<string, unknown> {
  const userDto = msg.user;
  // C-1: mask non-public HUMAN users so private account real names never surface
  // in the home feed. assembleHomeUser defaults public:false, so maskUserPrivacy
  // anonymizes non-public humans. A user is public when they're a joined member of
  // a discoverable public/open group (publicUserIds, computed once per request).
  // Bots pass through unmasked — a bot persona's name is content, not PII.
  const markPublic = (u: Record<string, unknown>) => {
    if (publicUserIds?.has(u.user_id as string)) u.public = true;
    return u;
  };
  const user = userDto ? maskUserPrivacy(markPublic(assembleHomeUser(userDto))) : null;

  const pageSlug = msg.custom_type;
  let data: { links?: Record<string, unknown>; highlights?: string[]; participantRole?: string } = {};
  try {
    data = JSON.parse(msg.data) as typeof data;
  } catch { /* ignore */ }

  const linksMap = data?.links ?? {};
  const key = Object.keys(linksMap).shift() ?? null;
  let val: unknown = Object.values(linksMap).shift() ?? null;
  if (key && ['text', 'section', 'fax'].includes(key) && pageSlug) {
    val = `${pageSlug}/${val}`;
  }

  const highlights: string[] | null = data?.highlights?.length ? data.highlights : null;

  // C-1: mask repliers too — same reasoning.
  const repliers = (msg.thread_info?.most_replies ?? []).map((r) => maskUserPrivacy(markPublic(assembleHomeUser(r))));
  const replycount = msg.thread_info?.reply_count ?? 0;

  // legacy takes first reaction's user_ids as "likes"
  const likes: string[] = msg.reactions[0]?.user_ids ?? [];

  return {
    channel_url: msg.channel_url,
    id: msg.message_id,
    timestamp: msg.created_at,
    msg: msg.message,
    participant_role: data.participantRole ?? null,
    user,
    mentioned_users: [],
    likes,
    replycount,
    repliers,
    link: { key, val },
    highlights,
  };
}

// ─── HomeGroup shape assembly ─────────────────────────────────────────────────

/**
 * Assemble a HomeGroup GQL object from a ChannelDTO + grouping label.
 * Mirrors legacy loadGroup().
 *
 * The channel's `data` JSON string may contain { description, requests }.
 * members are HomeUser objects built from the ChannelDTO's MemberDTO array.
 */
async function assembleHomeGroup(
  ctx: AppContext,
  channel: ChannelDTO,
  grouping: string,
  viewerUserId: string | null = null,
): Promise<Record<string, unknown>> {
  const access = await getChannelAccess(ctx.db, channel.channel_url, viewerUserId);
  let description: string | null = channel.data || null;
  let requests: string[] = [];
  try {
    const parsed = JSON.parse(channel.data) as { description?: string; requests?: string[] };
    description = parsed.description ?? null;
    requests = parsed.requests ?? [];
  } catch { /* data is plain string description or empty */ }

  // Pending join-requester ids are operator-only: don't broadcast who asked to
  // join to every viewer of a (featured) group. Only an operator of THIS channel
  // sees the request list; everyone else gets []. (Legacy shipped these to all.)
  const isOperator = !!viewerUserId && channel.members.some(
    (m) => m.user_id === viewerUserId && m.role === 'operator' && m.state === 'joined',
  );
  if (!isOperator) requests = [];

  const latest = channel.last_message ? assembleHomeFeedItem(channel.last_message) : null;

  const members = channel.members.map((m) => assembleHomeUser(m));

  return {
    grouping,
    url: channel.channel_url,
    name: channel.name,
    description,
    privacy: channel.custom_type,
    picture: channel.cover_url || null,
    latest,
    requests,
    members,
    membership_policy: access.membershipPolicy,
    root_post_policy: access.rootPostPolicy,
    reply_policy: access.replyPolicy,
    reaction_policy: access.reactionPolicy,
  };
}

// ─── Feed algorithm (port of legacy filterFeedBoundMessages) ─────────────────

/**
 * Filter + sort a flat message list into the homefeed.
 * Mirrors legacy feedAlgorithm / filterFeedBoundMessages exactly:
 *   - Include all of the viewer's own messages
 *   - Exclude commentary messages (links.com matching /14\d{3}$/) posted by others
 *   - Exclude messages with no link, no thread, and body < 300 chars posted by others
 *   - Keep only messages with a custom_type (pageSlug present)
 *   - Sort descending by created_at
 */
// Every distinct author + replier user_id in a message list — the input to
// getPublicUserIds so the feed can unmask members of discoverable public groups.
function collectMessageUserIds(messages: MessageDTO[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    if (m.user?.user_id) ids.add(m.user.user_id);
    for (const r of m.thread_info?.most_replies ?? []) if (r.user_id) ids.add(r.user_id);
  }
  return [...ids];
}

export function feedAlgorithm(
  messages: MessageDTO[],
  viewerUserId: string | null,
  opts: { unfiltered?: boolean; publicUserIds?: Set<string> } = {},
): Record<string, unknown>[] {
  // Unlisted-beta channels (e.g. the Reformers discussion) are curated: every
  // root is intentional discussion, so we skip the general-feed noise heuristics
  // (page-slug custom_type requirement + short-unlinked drop) that would hide
  // free-form AI posts. Ordering is unchanged — always newest-first.
  const filtered = opts.unfiltered ? messages : messages.filter((m) => {
    let data: { links?: Record<string, unknown> } = {};
    try {
      data = JSON.parse(m.data) as typeof data;
    } catch { /* ignore */ }
    const isOwn = viewerUserId && m.user?.user_id === viewerUserId;
    if (isOwn) return true;
    if (data?.links) {
      const comVal = String(data.links['com'] ?? '');
      if (/14\d{3}$/.test(comVal)) return false;
    }
    if (!data?.links && !m.thread_info && m.message.length < 300) return false;
    return true;
  });

  return filtered
    .filter((m) => opts.unfiltered || !!m.custom_type)
    .sort((a, b) => b.created_at - a.created_at)
    .map((m) => assembleHomeFeedItem(m, opts.publicUserIds));
}

// ─── Featured channels helper ─────────────────────────────────────────────────

/**
 * Fetch featured (public/open) channels for a given lang.
 * Mirrors legacy getFeaturedGroups: filters by lang, falls back to 'en' when no results.
 */
async function getFeaturedChannels(ctx: AppContext, lang: string | null, limit = 20): Promise<ChannelDTO[]> {
  const effectiveLang = (!lang || lang === 'dev') ? 'en' : lang;
  let channels = await getPublicChannels(ctx.db, {
    lang: effectiveLang,
    limit,
  });
  if (channels.length === 0 && effectiveLang !== 'en') {
    channels = await getPublicChannels(ctx.db, { lang: 'en', limit: 50 });
  }
  if (!channels.length) return [];
  const policies = await ctx.db.selectFrom('messenger_channel_policy')
    .select(['channel_url', 'listed', 'enabled'])
    .where('channel_url', 'in', channels.map((channel) => channel.channel_url))
    .execute();
  const hidden = new Set(
    policies.filter((policy) => policy.enabled !== 1 || policy.listed !== 1)
      .map((policy) => policy.channel_url),
  );
  return channels.filter((channel) => !hidden.has(channel.channel_url));
}

/** Only explicit, enabled, unlisted channels are exposed by /home/feed. */
async function getUnlistedChannels(
  ctx: AppContext,
  viewerUserId: string | null,
): Promise<ChannelDTO[]> {
  const rows = await ctx.db.selectFrom('messenger_channel_policy')
    .select('channel_url')
    .where('enabled', '=', 1)
    .where('listed', '=', 0)
    .where('visibility', '=', 'unlisted')
    .execute();
  const channels = await Promise.all(rows.map(async ({ channel_url }) => {
    const access = await getChannelAccess(ctx.db, channel_url, viewerUserId);
    if (!access.canRead) return null;
    const channel = await getChannel(ctx.db, channel_url, viewerUserId ?? undefined);
    return channel ? projectChannelForViewer(channel, access) : null;
  }));
  return channels.filter((channel): channel is ChannelDTO => channel !== null);
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asGql = <T>(v: T): any => v;

export const communityResolvers: Resolvers = {
  Query: {
    /**
     * leaderboard — recent finishers + current-progress board (legacy
     * BomCommunity.ts:132). currentProgress: bom_user active in the last 90 days
     * (zip ≠ -1), ranked by `complete` DESC, top 50. recentFinishers: the last
     * 10 bom_log `finished` events. Each row → HomeUser via assembleHomeUser,
     * with non-public accounts anonymized (maskUserPrivacy). Bots are dropped.
     *
     * Privacy: a user is `public` (shown unmasked) iff they're a joined member
     * of a public/open group — computed live via getPublicUserIds, NOT the stale
     * bom_user.visibility column. Everyone else is anonymized. Legacy also
     * surfaced private users sharing a group with the viewer, but its shim for
     * that returned [] — so this is never less private than legacy.
     */
    leaderboard: async (_root, args, ctx: AppContext) => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const activeTimeFrame = now - 90 * 24 * 60 * 60;

        const rankedUsers = await ctx.db
          .selectFrom('bom_user')
          .select(['user', 'complete', 'finished', 'last_active'])
          .where('last_active', '>', activeTimeFrame)
          .where('zip', '!=', '-1')
          .orderBy('complete', 'desc')
          .limit(100)
          .execute();

        const recentFinishes = await ctx.db
          .selectFrom('bom_log')
          .select(['timestamp', 'user'])
          .where('type', '=', 'finished')
          .orderBy('timestamp', 'desc')
          .limit(10)
          .execute();

        // One batched messenger-user fetch for every username in play (md5 = user_id).
        const usernames = [...new Set([...rankedUsers.map((u) => u.user), ...recentFinishes.map((f) => f.user)])];
        const userIds = usernames.map((u) => md5(u));
        const [dtos, publicSet] = await Promise.all([
          getUsers(ctx.db, userIds),
          // Live visibility: public iff joined to a public/open group (replaces the
          // unmaintained bom_user.visibility column).
          getPublicUserIds(ctx.db, userIds),
        ]);
        const dtoById = new Map(dtos.map((d) => [d.user_id, d]));

        const buildHomeUser = (
          username: string,
          progress: BomUserProgress | null,
        ): Record<string, unknown> => {
          const dto = dtoById.get(md5(username)) ?? null;
          const hu = assembleHomeUser(dto, progress);
          hu.public = publicSet.has(md5(username));
          return maskUserPrivacy(hu);
        };

        const currentProgress = rankedUsers
          .slice(0, 50)
          .map((u) =>
            buildHomeUser(u.user, {
              user: u.user,
              complete: u.complete as unknown as number | null,
              finished: u.finished,
              last_active: u.last_active,
            }),
          )
          .filter((u) => !u.isBot)
          .sort((a, b) => (b.progress as number) - (a.progress as number));

        const recentFinishers = recentFinishes
          .map((f) => {
            const hu = buildHomeUser(f.user, {
              user: f.user,
              complete: null,
              finished: f.timestamp,
              last_active: null,
            });
            // recentFinishers carries the finish timestamp as the finished value.
            hu.finished = [f.timestamp];
            return hu;
          })
          .filter((u) => !u.isBot);

        return asGql({ recentFinishers, currentProgress });
      } catch (error) {
        console.error('leaderboard error:', error);
        return asGql({ recentFinishers: [], currentProgress: [] });
      }
    },

    /**
     * readingplan(token, slug) — the reading-plan widget on /home (slug e.g.
     * "cfm2024"). Scores the plan's segments against the user's completed
     * blocks since the plan start. Legacy BomCommunity.ts:494. Returns null when
     * the slug is unknown (frontend guards on planData).
     */
    readingplan: async (_root, args, ctx: AppContext) => {
      try {
        const queryBy = await resolveUsername(ctx, args.token as string | null | undefined);
        const slug = (args.slug as string | null | undefined) || null;
        return asGql(await loadReadingPlan(ctx.db, slug, { queryBy }, ctx.lang ?? null));
      } catch (error) {
        console.error('readingplan error:', error);
        return null;
      }
    },

    /**
     * loadGroupsFromHash — look up bom_shortlinks by hash[], then fetch
     * each referenced channel and return it as a StudyGroup shape.
     *
     * StudyGroup SDL fields mirror the legacy Sendbird channel DTO:
     *   name, member_count, custom_type, channel_url, created_at,
     *   cover_url, max_length_message, data, messages, members
     */
    loadGroupsFromHash: async (_root, args, ctx: AppContext) => {
      const hashes = (args.hash ?? []) as string[];
      if (!hashes.length) return [];

      const rows = await ctx.db
        .selectFrom('bom_shortlinks')
        .select(['hash', 'string'])
        .where('hash', 'in', hashes)
        .execute();

      const results = await Promise.all(
        rows.map(async (row) => {
          const channelUrl = row.string;
          if (!channelUrl) return null;
          const channel = await getChannel(ctx.db, channelUrl);
          if (!channel) return null;
          return asGql({
            name: channel.name,
            member_count: channel.member_count,
            custom_type: channel.custom_type,
            channel_url: channel.channel_url,
            created_at: channel.created_at,
            cover_url: channel.cover_url || null,
            max_length_message: null,
            data: channel.data,
            messages: null,
            members: null,
          });
        }),
      );
      return results.filter(Boolean);
    },

    /**
     * homefeed — returns { groups: [HomeGroup], feed: [HomeFeedItem] }.
     *
     * When `channel` is specified: single-channel mode — fetch that channel's
     * messages (or a specific message thread root) and gate on membership for
     * private channels.
     * Otherwise: featured channels + the viewer's own channels merged; feed
     * is the merged messages run through feedAlgorithm.
     */
    homefeed: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? null;

      const myUserId = await resolveMessengerUserId(ctx, args.token as string | null | undefined);

      try {
        const channelArg = args.channel as string[] | string | null | undefined;
        const messageArg = args.message as string[] | string | null | undefined;

        // Normalise scalar or array args (legacy accepted both via q() unwrap)
        const channelUrl = Array.isArray(channelArg) ? channelArg[0] : channelArg;
        const messageId = Array.isArray(messageArg) ? messageArg[0] : messageArg;

        if (channelUrl) {
          // Single-channel mode
          const channel = await getChannel(ctx.db, channelUrl, myUserId ?? undefined);
          if (!channel) return asGql({ groups: [], feed: [] });

          const access = await getChannelAccess(ctx.db, channelUrl, myUserId);
          if (!access.canRead) return asGql({ groups: [], feed: [] });
          if (args.unlisted === true && (
            !access.explicit || !access.enabled || access.listed || access.visibility !== 'unlisted'
          )) return asGql({ groups: [], feed: [] });
          const visibleChannel = projectChannelForViewer(channel, access);

          const groupObj = await assembleHomeGroup(ctx, visibleChannel, 'feed', myUserId);

          if (messageId) {
            // Specific-message mode: find the root message then return it
            const msgs = await getMessages(ctx.db, channelUrl, { limit: 50, includeReplies: true });
            let rootMsg = msgs.find((m) => m.message_id === messageId) ?? null;
            if (rootMsg?.parent_message_id) {
              const parentMsgs = await getMessages(ctx.db, channelUrl, { limit: 50, includeReplies: true });
              rootMsg = parentMsgs.find((m) => m.message_id === rootMsg!.parent_message_id) ?? rootMsg;
            }
            const feed = rootMsg ? [assembleHomeFeedItem(rootMsg)] : [];
            return asGql({ groups: [groupObj], feed });
          }

          // All messages for this channel
          const msgs = await getMessages(ctx.db, channelUrl, { limit: 30 });
          const publicSet = await getPublicUserIds(ctx.db, collectMessageUserIds(msgs));
          const feed = feedAlgorithm(msgs, myUserId, { unfiltered: true, publicUserIds: publicSet });
          return asGql({ groups: [groupObj], feed });
        }

        // Multi-channel mode: featured + user's own channels
        const featuredChannels = args.unlisted === true
          ? await getUnlistedChannels(ctx, myUserId)
          : await getFeaturedChannels(ctx, lang);
        const featuredUrls = new Set(featuredChannels.map((c) => c.channel_url));

        let myChannels: ChannelDTO[] = [];
        if (myUserId && args.unlisted !== true) {
          // Study groups only — DM messages don't belong in the home feed.
          myChannels = await getMyStudyGroups(ctx.db, myUserId);
        }

        // Merge, deduplicate, resolve groups
        const allChannels = [
          ...featuredChannels,
          ...myChannels.filter((c) => !featuredUrls.has(c.channel_url)),
        ];

        const allUrls = allChannels.map((c) => c.channel_url);
        const [groups, msgsByChannel] = await Promise.all([
          Promise.all(allChannels.map((c) => assembleHomeGroup(ctx, c, c.custom_type === 'public' || c.custom_type === 'open' ? 'featured_groups' : 'my_groups', myUserId))),
          // One windowed query for 30 messages × every channel, vs a getMessages() per channel.
          getMessagesForChannels(ctx.db, allUrls, 30),
        ]);

        const flatMsgs = [...msgsByChannel.values()].flat();
        const publicSet = await getPublicUserIds(ctx.db, collectMessageUserIds(flatMsgs));
        const feed = feedAlgorithm(flatMsgs, myUserId, { unfiltered: true, publicUserIds: publicSet });
        return asGql({ groups, feed });
      } catch (err) {
        console.error('homefeed error:', err);
        return asGql({ groups: [], feed: [] });
      }
    },

    /**
     * homethread — return all replies to a message in a channel.
     * For private channels, gates on the viewer being a member.
     */
    homethread: async (_root, args, ctx: AppContext) => {
      const channelUrl = args.channel as string | null | undefined;
      const messageId = args.message as string | null | undefined;

      if (!channelUrl || !messageId) return asGql([]);

      try {
        const channel = await getChannel(ctx.db, channelUrl);
        if (!channel) return asGql([]);

        const myUserId = await resolveMessengerUserId(ctx, args.token as string | null | undefined);
        if (!(await getChannelAccess(ctx.db, channelUrl, myUserId)).canRead) return asGql([]);

        // Bind the object ID to the authorized channel before querying by
        // parent_message_id; otherwise a readable channel URL could be paired
        // with a private channel's root ID.
        const root = await getMessage(ctx.db, channelUrl, messageId);
        if (!root || root.parent_message_id) return asGql([]);

        const replies = await getThread(ctx.db, messageId);
        const publicSet = await getPublicUserIds(ctx.db, collectMessageUserIds(replies));
        return asGql(replies.map((m) => assembleHomeFeedItem(m, publicSet)));
      } catch (err) {
        console.error('homethread error:', err);
        return asGql([]);
      }
    },

    /**
     * homegroups — return [HomeGroup] mixing user's channels + featured channels.
     * The `grouping` arg filters: 'my_groups' | 'featured_groups' | null (both).
     */
    homegroups: async (_root, args, ctx: AppContext) => {
      const lang = ctx.lang ?? null;
      const groupingFilter = args.grouping as string | null | undefined;

      try {
        const myUserId = await resolveMessengerUserId(ctx, args.token as string | null | undefined);
        const featuredChannels = await getFeaturedChannels(ctx, lang);
        const featuredUrls = new Set(featuredChannels.map((c) => c.channel_url));

        let myChannels: ChannelDTO[] = [];
        if (myUserId) {
          myChannels = await getMyStudyGroups(ctx.db, myUserId);
        }

        const myHomeGroups = await Promise.all(
          myChannels.map((c) => assembleHomeGroup(ctx, c, 'my_groups', myUserId)),
        );
        const featuredHomeGroups = await Promise.all(
          featuredChannels.map((c) => assembleHomeGroup(ctx, c, 'featured_groups', myUserId)),
        );

        // Filter by grouping arg
        if (groupingFilter === 'my_groups') return asGql(myHomeGroups);
        if (groupingFilter === 'featured_groups') return asGql(featuredHomeGroups);

        // Merge: my groups first, then featured not already in mine
        const max = groupingFilter ? 60 : 6;

        const myGroupUrls = new Set(myChannels.map((c) => c.channel_url));
        const filteredFeatured = featuredHomeGroups
          .filter((g) => !myGroupUrls.has(g['url'] as string))
          .slice(0, Math.max(0, max - Math.min(myHomeGroups.length, Math.floor(max / 2))));

        const myToKeep = myHomeGroups.slice(0, max - filteredFeatured.length);
        return asGql([...myToKeep, ...filteredFeatured]);
      } catch (err) {
        console.error('homegroups error:', err);
        return asGql([]);
      }
    },

    /**
     * requestedUsers — list users with pending join-requests on a private channel.
     * Only visible to operators of that channel.
     */
    requestedUsers: async (_root, args, ctx: AppContext) => {
      const tokenArg = args.token as string | null | undefined;
      const channelUrl = args.channel as string | null | undefined;

      if (!tokenArg || !channelUrl) return asGql([]);

      try {
        const myUserId = await resolveMessengerUserId(ctx, tokenArg);
        if (!myUserId) return asGql([]);

        // Fetch all members including requested state
        const members = await getChannelMembers(ctx.db, channelUrl);

        // Gate: viewer must be an operator
        const isOperator = members.some(
          (m) => m.user_id === myUserId && m.role === 'operator' && m.state === 'joined',
        );
        if (!isOperator) return asGql([]);

        // Return users in 'requested' state
        const requestedUserIds = members
          .filter((m) => m.state === 'requested')
          .map((m) => m.user_id);

        if (!requestedUserIds.length) return asGql([]);

        const users = await getUsers(ctx.db, requestedUserIds);
        return asGql(users.map((u) => assembleHomeUser(u)));
      } catch (err) {
        console.error('requestedUsers error:', err);
        return asGql([]);
      }
    },

    /**
     * botlist — return the pluggable study bots as [Bot].
     * Bot shape: { id, name, description, picture, enabled }
     *
     * Registration in bom_bot (bot_class='study') is what makes a bot
     * pickable; community bots and the dozens of junk is_bot=1 rows in
     * messenger_users never appear. Study bots are scoped to the request
     * language (bom_bot.lang, NULL = every language).
     */
    botlist: async (_root, args, ctx: AppContext) => {
      const channel = args.channel as string | null | undefined;
      // C-5: require authentication before exposing bot IDs. Bot user_id values
      // are internal MD5 hashes used throughout messenger authz; they must not be
      // enumerable by unauthenticated callers. Gate on ctx.bearerToken (set from
      // the Authorization header) — if no bearer is present the caller is
      // unauthenticated and we return an empty list.
      if (!ctx.auth) return asGql([]);
      try {
        const bots = await listStudyBots(ctx.db, ctx.lang);

        let channelBotIds = new Set<string>();
        if (channel) {
          const members = await ctx.db
            .selectFrom('messenger_members')
            .select('user_id')
            .where('channel_url', '=', channel)
            .execute();
          channelBotIds = new Set(members.map((m) => m.user_id));
        }

        return asGql(
          bots
            .filter((b) => !!b.user_id)
            .map((b) => {
              const meta = (b.metadata ?? {}) as Record<string, unknown>;
              return {
                id: b.user_id,
                name: b.nickname || 'Bot',
                description: String(meta['description'] ?? 'A helpful bot'),
                picture: b.profile_url || 'https://i.imgur.com/IwVZGhY.png',
                enabled: !channelBotIds.has(b.user_id!),
              };
            }),
        );
      } catch (err) {
        console.error('botlist error:', err);
        return asGql([]);
      }
    },
  },

  Mutation: {
    /**
     * joinGroup — join a channel identified by a bom_shortlinks hash.
     * hash → bom_shortlinks.string → channel_url → addUserToChannel (state=joined).
     * Fires user_joined + membership_changed on the RealtimeBus.
     */
    joinGroup: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const hash = args.hash as string | null | undefined;

      if (!token) return asGql({ isSuccess: false, msg: 'User token missing', channel: null, user: null });
      if (!hash) return asGql({ isSuccess: false, msg: 'Group hash missing', channel: null, user: null });

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return asGql({ isSuccess: false, msg: 'User not found', channel: null, user: null });

        const row = await ctx.db
          .selectFrom('bom_shortlinks')
          .select('string')
          .where('hash', '=', hash)
          .executeTakeFirst();
        const channelUrl = row?.string;
        if (!channelUrl) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });

        // C-2: gate on channel type — only 'open' channels are joinable via
        // shortlink hash. Private and DM channels must never be joinable by a
        // hash alone; 'public' channels require a join request (requestToJoinGroup).
        const channel = await getChannel(ctx.db, channelUrl);
        if (!channel) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });
        if (channel.custom_type !== 'open') {
          return asGql({ isSuccess: false, msg: 'Group is not open enrollment', channel: null, user: null });
        }
        const access = await getChannelAccess(ctx.db, channelUrl, myUserId);
        if (!access.canJoin) {
          return asGql({ isSuccess: false, msg: 'Group has fixed membership', channel: null, user: null });
        }

        const success = await addUserToChannel(ctx.db, channelUrl, myUserId, 'member');
        if (!success) return asGql({ isSuccess: false, msg: 'Already a member', channel: channelUrl, user: myUserId });

        const userDto = await getUser(ctx.db, myUserId);
        const userShape = userDto ? assembleHomeUser(userDto) : null;

        // Room sync first so the joiner's own live sockets hear this channel
        // from the very first event (no reconnect required).
        getBus().joinRoom(myUserId, channelUrl);
        getBus().emit('user_joined', channelUrl, { channelUrl, user: userShape });
        getBus().emit('membership_changed', channelUrl, { channelUrl, user: myUserId });

        return asGql({ isSuccess: true, msg: 'Joined group', channel: channelUrl, user: myUserId });
      } catch (err) {
        console.error('joinGroup error:', err);
        return asGql({ isSuccess: false, msg: 'Database error', channel: null, user: null });
      }
    },

    /**
     * joinOpenGroup — join a channel by its channel_url directly.
     * Validates custom_type === 'open'; then addUserToChannel (state=joined).
     * Fires user_joined + membership_changed on the RealtimeBus.
     */
    joinOpenGroup: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const url = args.url as string | null | undefined;

      if (!token) return asGql({ isSuccess: false, msg: 'User token missing', channel: null, user: null });
      if (!url) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return asGql({ isSuccess: false, msg: 'User not found', channel: null, user: null });

        const channel = await getChannel(ctx.db, url);
        if (!channel) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });
        if (channel.custom_type !== 'open') return asGql({ isSuccess: false, msg: 'Group is not open enrollment', channel: null, user: null });
        if (!(await getChannelAccess(ctx.db, url, myUserId)).canJoin) {
          return asGql({ isSuccess: false, msg: 'Group has fixed membership', channel: null, user: null });
        }

        const success = await addUserToChannel(ctx.db, url, myUserId, 'member');
        if (!success) return asGql({ isSuccess: false, msg: 'Already a member', channel: url, user: myUserId });

        const userDto = await getUser(ctx.db, myUserId);
        const userShape = userDto ? assembleHomeUser(userDto) : null;

        getBus().joinRoom(myUserId, url);
        getBus().emit('user_joined', url, { channelUrl: url, user: userShape });
        getBus().emit('membership_changed', url, { channelUrl: url, user: myUserId });

        return asGql({ isSuccess: true, msg: 'Joined group', channel: url, user: myUserId });
      } catch (err) {
        console.error('joinOpenGroup error:', err);
        return asGql({ isSuccess: false, msg: 'Database error', channel: null, user: null });
      }
    },

    /**
     * requestToJoinGroup — submit a join request on a public channel.
     * Validates custom_type === 'public'; inserts membership row with state='requested'
     * via an inline Kysely upsert (members.ts only exposes addUserToChannel → state='joined').
     * Fires membership_changed on the RealtimeBus.
     */
    requestToJoinGroup: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const url = args.url as string | null | undefined;

      if (!token) return asGql({ isSuccess: false, msg: 'User token missing', channel: null, user: null });
      if (!url) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return asGql({ isSuccess: false, msg: 'User not found', channel: null, user: null });

        const channel = await getChannel(ctx.db, url);
        if (!channel) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });
        if (channel.custom_type !== 'public') return asGql({ isSuccess: false, msg: 'Group is not public', channel: null, user: null });
        if (!(await getChannelAccess(ctx.db, url, myUserId)).canRequestMembership) {
          return asGql({ isSuccess: false, msg: 'Group has fixed membership', channel: null, user: null });
        }

        // Re-entry guard (spec §2): a banned row would dup-key below and be
        // masked as success — refuse explicitly instead.
        if (await isUserBanned(ctx.db, url, myUserId)) {
          return asGql({ isSuccess: false, msg: 'Cannot join this group', channel: null, user: null });
        }

        // Insert with state='requested'. A duplicate-key (already requested/joined) is
        // success; a genuine write failure must NOT be masked as success.
        try {
          await ctx.db
            .insertInto('messenger_members')
            .values({
              channel_url: url,
              user_id: myUserId,
              role: 'member',
              state: 'requested',
            })
            .execute();
        } catch (e) {
          if (!isDuplicateKeyError(e)) {
            console.error('requestToJoinGroup insert error:', e);
            return asGql({ isSuccess: false, msg: 'Database error', channel: null, user: null });
          }
          // duplicate-key: already requested or a member — treat as success
        }

        getBus().emit('membership_changed', url, { channelUrl: url, user: myUserId });

        return asGql({ isSuccess: true, msg: 'Request submitted', channel: url, user: myUserId });
      } catch (err) {
        console.error('requestToJoinGroup error:', err);
        return asGql({ isSuccess: false, msg: 'Database error', channel: null, user: null });
      }
    },

    /**
     * withdrawRequest — cancel a pending join request on a public channel.
     * Validates custom_type === 'public'; deletes the membership row WHERE
     * state='requested' ONLY — a banned (or joined/invited) row survives, or a
     * banned user could withdraw their own ban row and rejoin (spec §2).
     * Fires membership_changed on the RealtimeBus.
     */
    withdrawRequest: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const url = args.url as string | null | undefined;

      if (!token) return asGql({ isSuccess: false, msg: 'User token missing', channel: null, user: null });
      if (!url) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return asGql({ isSuccess: false, msg: 'User not found', channel: null, user: null });

        const channel = await getChannel(ctx.db, url);
        if (!channel) return asGql({ isSuccess: false, msg: 'Group not found', channel: null, user: null });
        if (channel.custom_type !== 'public') return asGql({ isSuccess: false, msg: 'Group is not public', channel: null, user: null });

        await deleteMembershipRowInState(ctx.db, url, myUserId, 'requested');

        getBus().emit('membership_changed', url, { channelUrl: url, user: myUserId });

        return asGql({ isSuccess: true, msg: 'Request withdrawn', channel: url, user: myUserId });
      } catch (err) {
        console.error('withdrawRequest error:', err);
        return asGql({ isSuccess: false, msg: 'Database error', channel: null, user: null });
      }
    },

    /**
     * processRequest — operator grants or denies a pending join request.
     * Caller must be an operator on the channel; target user_id must exist.
     * grant=true  → addUserToChannel (state=joined) + delete the requested row first
     *             → fires user_joined + membership_changed
     * grant=false → delete the requested row → fires membership_changed
     * Both deletes are scoped WHERE state='requested' (deleteMembershipRowInState):
     * denying a since-banned user must NOT delete the ban row (deny is not an
     * unban, spec §2), and a joined/invited row is never collateral either.
     * Returns Boolean per SDL.
     */
    processRequest: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const channelArg = args.channel as string | null | undefined;
      const targetUserId = args.user_id as string | null | undefined;
      const grant = args.grant as boolean | null | undefined;

      if (!token || !channelArg || !targetUserId) return false;

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return false;

        const members = await getChannelMembers(ctx.db, channelArg);

        // Gate: caller must be an operator
        const isOperator = members.some(
          (m) => m.user_id === myUserId && m.role === 'operator' && m.state === 'joined',
        );
        if (!isOperator) return false;

        if (grant) {
          // Re-entry guard (spec §2): never let a grant delete a banned row and
          // re-admit the user — unban is the only path out of 'banned'.
          if (await isUserBanned(ctx.db, channelArg, targetUserId)) return false;
          // Remove the requested row first so addUserToChannel doesn't hit a dup-key
          await deleteMembershipRowInState(ctx.db, channelArg, targetUserId, 'requested');
          const added = await addUserToChannel(ctx.db, channelArg, targetUserId, 'member');
          if (!added) return false;

          const userDto = await getUser(ctx.db, targetUserId);
          const userShape = userDto ? assembleHomeUser(userDto) : null;

          getBus().joinRoom(targetUserId, channelArg);
          getBus().emit('user_joined', channelArg, { channelUrl: channelArg, user: userShape });
          getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: targetUserId });
        } else {
          // Deny: remove the requested membership row ONLY — a banned row must
          // survive (deny of a since-banned user is not an unban).
          await deleteMembershipRowInState(ctx.db, channelArg, targetUserId, 'requested');
          getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: targetUserId });
        }

        return true;
      } catch (err) {
        console.error('processRequest error:', err);
        return false;
      }
    },

    /**
     * addBot — add a bot user to a channel.
     *
     * Port of BomCommunity.ts addBot (~:544).
     * The `bot` arg is the messenger user_id (already hashed; same value the
     * legacy resolver passed directly to sendbird.addUserToChannel).
     * Gate: the acting user must be an operator of the channel.
     * Fires user_joined + membership_changed on the RealtimeBus on success.
     * Returns Boolean per SDL.
     */
    addBot: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const channelArg = args.channel as string | null | undefined;
      const botId = args.bot as string | null | undefined;

      if (!token || !channelArg || !botId) return false;

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return false;

        // Gate: acting user must be an operator of the channel.
        const members = await getChannelMembers(ctx.db, channelArg);
        const isOperator = members.some(
          (m) => m.user_id === myUserId && m.role === 'operator' && m.state === 'joined',
        );
        if (!isOperator) return false;

        const success = await addBotToChannel(ctx.db, channelArg, botId);
        if (!success) return false;

        // Fan-out: same events as joinGroup/processRequest-grant. Bots hold
        // live sockets too (MESSENGER_BOT_TOKEN) — sync their room membership.
        getBus().joinRoom(botId, channelArg);
        const botDto = await getUser(ctx.db, botId);
        const botShape = botDto ? assembleHomeUser(botDto) : null;
        getBus().emit('user_joined', channelArg, { channelUrl: channelArg, user: botShape });
        getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: botId });

        return true;
      } catch (err) {
        console.error('addBot error:', err);
        return false;
      }
    },

    /**
     * removeBot — remove a bot user from a channel.
     *
     * Port of BomCommunity.ts removeBot (~:561).
     * Gate: acting user must be an operator of the channel.
     * Fires membership_changed on the RealtimeBus on success.
     * Returns Boolean per SDL.
     */
    removeBot: async (_root, args, ctx: AppContext) => {
      const token = args.token as string | null | undefined;
      const channelArg = args.channel as string | null | undefined;
      const botId = args.bot as string | null | undefined;

      if (!token || !channelArg || !botId) return false;

      try {
        const myUserId = await resolveMessengerUserId(ctx, token);
        if (!myUserId) return false;

        // Gate: acting user must be an operator of the channel.
        const members = await getChannelMembers(ctx.db, channelArg);
        const isOperator = members.some(
          (m) => m.user_id === myUserId && m.role === 'operator' && m.state === 'joined',
        );
        if (!isOperator) return false;

        const success = await removeBotFromChannel(ctx.db, channelArg, botId);
        if (!success) return false;

        getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: botId });
        getBus().leaveRoom(botId, channelArg);

        return true;
      } catch (err) {
        console.error('removeBot error:', err);
        return false;
      }
    },
  },
};
