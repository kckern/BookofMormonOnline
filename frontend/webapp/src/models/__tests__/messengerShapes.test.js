import {
  shapeUser,
  shapeMember,
  shapeMessage,
  shapeChannelFields,
  shapeThreadInfo,
  shapeReacters,
} from "../messengerShapes";

const gqlUser = {
  user_id: "u1",
  nickname: "Nick",
  profile_url: "http://x/p.png",
  metadata: { activeGroup: "g1", summary: "{}" },
  is_online: true,
  last_seen_at: 123,
  is_bot: false,
};

test("shapeUser maps the full SendBird user shape (incl. snake_case alias)", () => {
  const u = shapeUser(gqlUser);
  expect(u).toMatchObject({
    userId: "u1",
    user_id: "u1", // legacy snake_case consumers (Sidebar.js)
    nickname: "Nick",
    profileUrl: "http://x/p.png",
    plainProfileUrl: "http://x/p.png",
    connectionStatus: "online",
    lastSeenAt: 123,
  });
  expect(u.metaData).toEqual({ activeGroup: "g1", summary: "{}" });
});

test("shapeUser defaults: no metadata → {}, offline, bot flag folded in", () => {
  const u = shapeUser({ user_id: "u2", is_bot: true });
  expect(u.metaData).toEqual({ isBot: true });
  expect(u.connectionStatus).toBe("offline");
});

test("shapeMember includes role/state/muted on top of the user shape", () => {
  const m = shapeMember({ ...gqlUser, role: "operator", state: "joined", is_muted: true });
  expect(m.role).toBe("operator");
  expect(m.state).toBe("joined");
  expect(m.isMuted).toBe(true);
  expect(m.plainProfileUrl).toBe("http://x/p.png");
  expect(m.metaData).toEqual(gqlUser.metadata);
  expect(m.connectionStatus).toBe("online");
});

test("shapeMessage: sender + _sender alias, messageType, safe defaults", () => {
  const msg = shapeMessage({
    message_id: "10",
    channel_url: "c1",
    message: "hello",
    message_type: "MESG",
    user: gqlUser,
    created_at: 5,
  });
  expect(msg.messageId).toBe("10");
  expect(msg.messageType).toBe("user"); // MESG→user, ADMN→admin, FILE→file
  expect(msg.sender.userId).toBe("u1");
  expect(msg.sender.plainProfileUrl).toBe("http://x/p.png");
  expect(msg.sender.metaData).toEqual(gqlUser.metadata);
  expect(msg._sender).toBe(msg.sender); // legacy underscore consumers
  expect(msg.mentionedUsers).toEqual([]); // never undefined (formatText does .length)
});

test("shapeMessage: missing user yields a null-safe sender", () => {
  const msg = shapeMessage({ message_id: "11", message: "x", message_type: "ADMN" });
  expect(msg.messageType).toBe("admin");
  expect(msg.sender.metaData).toEqual({}); // Study.js destructures sender.metaData
  expect(msg.mentionedUsers).toEqual([]);
});

test("shapeMessage: mentions stored in data JSON are surfaced as user-ish objects", () => {
  const msg = shapeMessage(
    {
      message_id: "12",
      message: "@Nick hi",
      message_type: "MESG",
      data: JSON.stringify({ mentionedUserIds: ["u1"], mentionType: "users" }),
    },
    { resolveUser: (id) => (id === "u1" ? shapeUser(gqlUser) : null) }
  );
  expect(msg.mentionedUsers.map((u) => u.userId)).toEqual(["u1"]);
  expect(msg.mentionType).toBe("users");
});

test("shapeChannelFields: myRole/myMemberState/joinedMemberCount for the current user", () => {
  const ch = {
    channel_url: "c1",
    members: [
      { ...gqlUser, role: "operator", state: "joined" },
      { user_id: "u9", role: "member", state: "invited" },
    ],
  };
  const f = shapeChannelFields(ch, "u1");
  expect(f.myRole).toBe("operator");
  expect(f.myMemberState).toBe("joined");
  expect(f.joinedMemberCount).toBe(1);
  expect(f.members[0].plainProfileUrl).toBe("http://x/p.png");
});

test("shapeChannelFields: non-member viewer gets none/undefined gracefully", () => {
  const f = shapeChannelFields({ members: [] }, "stranger");
  expect(f.myRole).toBe("none");
  expect(f.joinedMemberCount).toBe(0);
});

// thread_info arrives snake_case from the green-field backend
// ({ reply_count, most_replied_users }), and the legacy response filter
// strips null/empty keys. The SendBird-compat shape must always carry
// camelCase replyCount and an array mostRepliedUsers, or ThreadedMessages
// crashes mapping over undefined.
test("shapeThreadInfo maps reply_count and defaults mostRepliedUsers", () => {
  expect(shapeThreadInfo({ reply_count: 3 })).toEqual({
    replyCount: 3,
    mostRepliedUsers: [],
  });
});

test("shapeThreadInfo maps most_replied_users through shapeUser (replier faces)", () => {
  const shaped = shapeThreadInfo({
    reply_count: 2,
    most_replied_users: [
      { user_id: "u1", nickname: "Alice", profile_url: "http://x/a.png", is_bot: false },
      { user_id: "u2", nickname: "Bot", profile_url: "http://x/b.png", is_bot: true },
    ],
  });
  expect(shaped.replyCount).toBe(2);
  expect(shaped.mostRepliedUsers).toHaveLength(2);
  expect(shaped.mostRepliedUsers[0]).toMatchObject({
    userId: "u1",
    nickname: "Alice",
    plainProfileUrl: "http://x/a.png", // ThreadedMessages reads plainProfileUrl
  });
  expect(shaped.mostRepliedUsers[1].metaData.isBot).toBe(true);
});

test("shapeThreadInfo handles absent/null thread_info", () => {
  expect(shapeThreadInfo(null)).toEqual({ replyCount: 0, mostRepliedUsers: [] });
  expect(shapeThreadInfo(undefined)).toEqual({ replyCount: 0, mostRepliedUsers: [] });
});

test("shapeThreadInfo passes through an already-camelCase event payload", () => {
  expect(shapeThreadInfo({ replyCount: 2 })).toEqual({
    replyCount: 2,
    mostRepliedUsers: [],
  });
});

// Reaction display: userIds must resolve to the matching member, NOT by
// array position (the legacy bug showed members[0] as the reacter).
test("shapeReacters resolves reacting users by id with id fallback", () => {
  const members = [
    { userId: "kip", nickname: "Kip Orth" },
    { userId: "staff", nickname: "Staff" },
  ];
  const reactions = [{ key: "like", userIds: ["staff", "ghost"] }];
  const out = shapeReacters(reactions, members);
  expect(out.like).toEqual([
    { userId: "ghost", nickname: "ghost" }, // unknown id falls back to the id
    { userId: "staff", nickname: "Staff" }, // reversed order preserved
  ]);
});

test("shapeReacters handles empty inputs", () => {
  expect(shapeReacters([], [])).toEqual({});
  expect(shapeReacters(undefined, undefined)).toEqual({});
});
