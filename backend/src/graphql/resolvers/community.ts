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
import { getChannel, getMyStudyGroups, getPublicChannels } from '../../messaging/channels.js';
import { getChannelMembers, addUserToChannel, removeUserFromChannel, getPublicUserIds, isUserBanned } from '../../messaging/members.js';
import { getMessages, getMessagesForChannels, getThread } from '../../messaging/messages.js';
import { getUser, getUsers, listStudyBots } from '../../messaging/users.js';
import { addBotToChannel, removeBotFromChannel } from '../../messaging/bots/registry.js';
import type { ChannelDTO, MessageDTO, UserDTO } from '../../messaging/dto.js';
import { getBus } from '../../realtime/RealtimeBus.js';
import { isDuplicateKeyError } from '../../data/errors.js';
import { loadReadingPlan } from '../../messaging/readingplan.js';

// ─── Token → messenger user_id ───────────────────────────────────────────────

/**
 * Resolve a GraphQL token arg to the messenger user_id (md5 of bom_user.user).
 * Returns null when the token is absent or unknown.
 */
async function resolveMessengerUserId(ctx: AppContext, token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const row = await ctx.db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select('bom_user.user as username')
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  if (!row) return null;
  return md5(row.username);
}

/**
 * Resolve a token to the bom_user.user it belongs to (the raw username used to
 * score bom_log credit). Falls back to the token itself for anon users, who log
 * progress under their token — matches legacy readingplan queryBy.
 */
async function resolveUsername(ctx: AppContext, token: string | null | undefined): Promise<string> {
  if (!token) return '';
  const row = await ctx.db
    .selectFrom('bom_user_token')
    .innerJoin('bom_user', 'bom_user.user', 'bom_user_token.user')
    .select('bom_user.user as username')
    .where('bom_user_token.token', '=', token)
    .limit(1)
    .executeTakeFirst();
  return row?.username ?? token;
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
 */
function maskUserPrivacy(u: Record<string, unknown>): Record<string, unknown> {
  if (u.public) return u;
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
function assembleHomeFeedItem(msg: MessageDTO): Record<string, unknown> {
  const userDto = msg.user;
  const user = userDto ? assembleHomeUser(userDto) : null;

  const pageSlug = msg.custom_type;
  let data: { links?: Record<string, unknown>; highlights?: string[] } = {};
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

  const repliers = (msg.thread_info?.most_replies ?? []).map((r) => assembleHomeUser(r));
  const replycount = msg.thread_info?.reply_count ?? 0;

  // legacy takes first reaction's user_ids as "likes"
  const likes: string[] = msg.reactions[0]?.user_ids ?? [];

  return {
    channel_url: msg.channel_url,
    id: msg.message_id,
    timestamp: msg.created_at,
    msg: msg.message,
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
  const isOperator =
    !!viewerUserId && channel.members.some((m) => m.user_id === viewerUserId && m.role === 'operator');
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
function feedAlgorithm(
  messages: MessageDTO[],
  viewerUserId: string | null,
): Record<string, unknown>[] {
  const filtered = messages.filter((m) => {
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
    .filter((m) => !!m.custom_type)
    .sort((a, b) => b.created_at - a.created_at)
    .map(assembleHomeFeedItem);
}

// ─── Featured channels helper ─────────────────────────────────────────────────

/**
 * Fetch featured (public/open) channels for a given lang.
 * Mirrors legacy getFeaturedGroups: filters by lang, falls back to 'en' when no results.
 */
async function getFeaturedChannels(ctx: AppContext, lang: string | null, limit = 20): Promise<ChannelDTO[]> {
  const effectiveLang = (!lang || lang === 'dev') ? 'en' : lang;
  const channels = await getPublicChannels(ctx.db, {
    lang: effectiveLang,
    limit,
  });
  if (channels.length === 0 && effectiveLang !== 'en') {
    return getPublicChannels(ctx.db, { lang: 'en', limit: 50 });
  }
  return channels;
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
      const slug = (args.slug ?? '') as string;
      if (!slug) return null;
      try {
        const queryBy = await resolveUsername(ctx, args.token as string | null | undefined);
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

          // Gate private channels on membership
          if (channel.custom_type === 'private' || channel.custom_type === 'DM') {
            if (!myUserId) return asGql({ groups: [], feed: [] });
            const isMember = channel.members.some((m) => m.user_id === myUserId);
            if (!isMember) return asGql({ groups: [], feed: [] });
          }

          const groupObj = await assembleHomeGroup(ctx, channel, 'feed', myUserId);

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
          const feed = feedAlgorithm(msgs, myUserId);
          return asGql({ groups: [groupObj], feed });
        }

        // Multi-channel mode: featured + user's own channels
        const featuredChannels = await getFeaturedChannels(ctx, lang);
        const featuredUrls = new Set(featuredChannels.map((c) => c.channel_url));

        let myChannels: ChannelDTO[] = [];
        if (myUserId) {
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

        const feed = feedAlgorithm([...msgsByChannel.values()].flat(), myUserId);
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

        // Gate private channels
        if (channel.custom_type === 'private' || channel.custom_type === 'DM') {
          const myUserId = await resolveMessengerUserId(ctx, args.token as string | null | undefined);
          if (!myUserId) return asGql([]);
          const isMember = channel.members.some((m) => m.user_id === myUserId);
          if (!isMember) return asGql([]);
        }

        const replies = await getThread(ctx.db, messageId);
        return asGql(replies.map(assembleHomeFeedItem));
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
          (m) => m.user_id === myUserId && m.role === 'operator',
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
    botlist: async (_root, _args, ctx: AppContext) => {
      try {
        const bots = await listStudyBots(ctx.db, ctx.lang);
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
                enabled: true,
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

        const success = await addUserToChannel(ctx.db, channelUrl, myUserId, 'member');
        if (!success) return asGql({ isSuccess: false, msg: 'Already a member', channel: channelUrl, user: myUserId });

        const userDto = await getUser(ctx.db, myUserId);
        const userShape = userDto ? assembleHomeUser(userDto) : null;

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

        const success = await addUserToChannel(ctx.db, url, myUserId, 'member');
        if (!success) return asGql({ isSuccess: false, msg: 'Already a member', channel: url, user: myUserId });

        const userDto = await getUser(ctx.db, myUserId);
        const userShape = userDto ? assembleHomeUser(userDto) : null;

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
     * Validates custom_type === 'public'; removes the membership row (regardless of state).
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

        await removeUserFromChannel(ctx.db, url, myUserId);

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
     * grant=true  → addUserToChannel (state=joined) + remove the requested row first
     *             → fires user_joined + membership_changed
     * grant=false → removeUserFromChannel (deletes the requested row)
     *             → fires membership_changed
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
          (m) => m.user_id === myUserId && m.role === 'operator',
        );
        if (!isOperator) return false;

        if (grant) {
          // Re-entry guard (spec §2): never let a grant delete a banned row and
          // re-admit the user — unban is the only path out of 'banned'.
          if (await isUserBanned(ctx.db, channelArg, targetUserId)) return false;
          // Remove the requested row first so addUserToChannel doesn't hit a dup-key
          await removeUserFromChannel(ctx.db, channelArg, targetUserId);
          const added = await addUserToChannel(ctx.db, channelArg, targetUserId, 'member');
          if (!added) return false;

          const userDto = await getUser(ctx.db, targetUserId);
          const userShape = userDto ? assembleHomeUser(userDto) : null;

          getBus().emit('user_joined', channelArg, { channelUrl: channelArg, user: userShape });
          getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: targetUserId });
        } else {
          // Deny: remove the requested membership row
          await removeUserFromChannel(ctx.db, channelArg, targetUserId);
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
          (m) => m.user_id === myUserId && m.role === 'operator',
        );
        if (!isOperator) return false;

        const success = await addBotToChannel(ctx.db, channelArg, botId);
        if (!success) return false;

        // Fan-out: same events as joinGroup/processRequest-grant.
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
          (m) => m.user_id === myUserId && m.role === 'operator',
        );
        if (!isOperator) return false;

        const success = await removeBotFromChannel(ctx.db, channelArg, botId);
        if (!success) return false;

        getBus().emit('membership_changed', channelArg, { channelUrl: channelArg, user: botId });

        return true;
      } catch (err) {
        console.error('removeBot error:', err);
        return false;
      }
    },
  },
};
