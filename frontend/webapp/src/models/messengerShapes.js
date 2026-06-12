// Pure GraphQL→SendBird shape mappers for the messenger compat shim.
// MessengerController delegates here; tests import this module only
// (the controller drags in socket.io and can't run under jsdom).

const MESSAGE_TYPE = { MESG: "user", ADMN: "admin", FILE: "file" };

export function shapeUser(u = {}) {
  const metaData = {
    ...(u.metadata || {}),
    ...(u.is_bot ? { isBot: true } : {}),
  };
  return {
    userId: u.user_id,
    user_id: u.user_id, // legacy snake_case consumers (Sidebar.js:384)
    nickname: u.nickname,
    profileUrl: u.profile_url,
    plainProfileUrl: u.profile_url,
    metaData,
    connectionStatus: u.is_online ? "online" : "offline",
    lastSeenAt: u.last_seen_at || null,
  };
}

export function shapeMember(m = {}) {
  return {
    ...shapeUser(m),
    role: m.role || "member",
    state: m.state || "joined",
    isMuted: !!m.is_muted,
  };
}

export function parseMessageData(raw) {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

// opts.resolveUser: (userId) => shaped user | null — used to surface
// mentions (stored as ids in the data JSON) as user objects, the shape
// Utils.formatText expects.
export function shapeMessage(msg = {}, opts = {}) {
  const sender = msg.user ? shapeUser(msg.user) : { metaData: {} };
  const dataObj = parseMessageData(msg.data);
  const mentionedIds = Array.isArray(dataObj.mentionedUserIds)
    ? dataObj.mentionedUserIds
    : [];
  const resolveUser = opts.resolveUser || (() => null);
  const mentionedUsers = mentionedIds
    .map((id) => resolveUser(id) || { userId: id, nickname: id, metaData: {} })
    .filter(Boolean);
  return {
    messageId: msg.message_id,
    channelUrl: msg.channel_url,
    message: msg.message,
    messageType: MESSAGE_TYPE[msg.message_type] || "user",
    customType: msg.custom_type,
    data: msg.data,
    parentMessageId: msg.parent_message_id,
    sender,
    _sender: sender, // legacy underscore consumers (StudyGroupSelect, appController)
    mentionedUsers,
    mentionType: dataObj.mentionType || "users",
    createdAt: msg.created_at,
    updatedAt: msg.updated_at,
  };
}

// thread_info arrives snake_case ({ reply_count, most_replied_users }),
// and the legacy response filter strips null/empty keys. Always emit the
// full SendBird ThreadInfo shape: ThreadedMessages maps mostRepliedUsers
// unconditionally (replier faces).
export function shapeThreadInfo(ti) {
  return {
    replyCount: ti?.reply_count ?? ti?.replyCount ?? 0,
    mostRepliedUsers: Array.isArray(ti?.most_replied_users)
      ? ti.most_replied_users.map(shapeUser)
      : [],
  };
}

// Resolve reaction userIds to member display objects BY ID — the legacy
// version indexed the members array by loop position, so every reaction
// displayed as whoever happened to sit at that index (e.g. members[0]).
// Unknown ids (member left the group) fall back to the raw id.
export function shapeReacters(reactions, members) {
  const byId = {};
  for (const m of members || []) byId[m.userId] = m;
  const reacters = {};
  for (const r of reactions || []) {
    reacters[r.key] = (r.userIds || [])
      .map((id) => ({
        userId: id,
        nickname: byId[id]?.nickname || id,
      }))
      .reverse();
  }
  return reacters;
}

// Channel DATA fields only (methods live on the controller's channel object).
export function shapeChannelFields(ch = {}, currentUserId) {
  const members = (ch.members || []).map(shapeMember);
  const me = members.find((m) => m.userId === currentUserId);
  return {
    members,
    myRole: me ? me.role : "none",
    myMemberState: me ? me.state : "none",
    joinedMemberCount: members.filter((m) => m.state === "joined").length,
  };
}
