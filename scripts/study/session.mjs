// UserSession — one simulated user's HTTP (GraphQL) + WebSocket (socket.io)
// presence. Everything the CLI does routes through a UserSession so the acting
// user is always explicit. Inbound socket events are buffered into a ring log
// and optionally streamed to a live watcher.

import { createRequire } from "module";
import crypto from "crypto";
import { gql, J, JA } from "./gql.mjs";

// socket.io-client lives in the backend workspace (repo root has no manifest).
const require = createRequire("/home/bom/BookofMormonOnline/backend/");
const { io } = require("socket.io-client");

export const md5 = (s) => crypto.createHash("md5").update(String(s)).digest("hex");

// Server→client events we mirror into each user's event log.
const INBOUND = [
  "message_received", "message_updated", "message_deleted",
  "reaction_changed", "user_presence", "typing", "unread_count_changed", "update_state",
];

export class UserSession {
  constructor(base, username, token) {
    this.base = base;
    this.username = username;
    this.token = token;
    this.userId = md5(username);
    this.socket = null;
    this.events = [];
    this.maxEvents = 1000;
    this._watch = null;
  }

  // ---- HTTP ----
  // Community/Feed resolvers read a `token:"..."` ARG; Messenger resolvers read
  // the bearer header. We send the bearer here and pass the arg where needed.
  gql(query) { return gql(this.base, query, { token: this.token }); }

  // ---- socket lifecycle ----
  connect(timeoutMs = 8000) {
    if (this.socket && this.socket.connected) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      const s = io(this.base, {
        path: "/messenger",
        transports: ["websocket"],
        auth: { userId: this.userId, token: this.token },
        reconnection: false,
        timeout: timeoutMs,
      });
      this.socket = s;
      for (const ev of INBOUND) s.on(ev, (payload) => this._record(ev, payload));
      s.once("connect", () => resolve(this));
      s.once("connect_error", (e) =>
        reject(new Error(`socket connect_error [${this.username}]: ${e.message}`)));
    });
  }

  disconnect() { if (this.socket) { this.socket.disconnect(); this.socket = null; } }

  _record(event, payload) {
    const entry = { t: Date.now(), user: this.username, event, payload };
    this.events.push(entry);
    if (this.events.length > this.maxEvents) this.events.shift();
    if (this._watch) this._watch(entry);
  }

  onEvent(cb) { this._watch = cb; }
  offEvent() { this._watch = null; }

  // Emit a client→server event; resolve with the server ack if any, else null
  // after a short grace period (handlers don't all ack).
  emit(event, payload) {
    if (!this.socket || !this.socket.connected)
      return Promise.reject(new Error(`[${this.username}] socket not connected (call connect first)`));
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      this.socket.emit(event, payload, (ack) => finish(ack ?? { ok: true }));
      setTimeout(() => finish(null), 1500);
    });
  }

  // ---- socket surface ----
  sendMessage(channelUrl, message, extra = {}) { return this.emit("send_message", { channelUrl, message, ...extra }); }
  reply(channelUrl, parentMessageId, message, extra = {}) { return this.emit("send_message", { channelUrl, message, parentMessageId, ...extra }); }
  editMessage(channelUrl, messageId, message) { return this.emit("edit_message", { channelUrl, messageId, message }); }
  deleteMessage(channelUrl, messageId) { return this.emit("delete_message", { channelUrl, messageId }); }
  addReaction(channelUrl, messageId, reaction) { return this.emit("add_reaction", { channelUrl, messageId, reaction }); }
  removeReaction(channelUrl, messageId, reaction) { return this.emit("remove_reaction", { channelUrl, messageId, reaction }); }
  typingStart(channelUrl) { return this.emit("typing_start", { channelUrl }); }
  typingStop(channelUrl) { return this.emit("typing_stop", { channelUrl }); }
  markRead(channelUrl) { return this.emit("mark_read", { channelUrl }); }

  // ---- HTTP surface: Messenger ----
  async createChannel({ name, customType = "group", description = "", userIds = [], operatorIds = [] }) {
    const q = `mutation{ messengerCreateChannel(name:${J(name)}, customType:${J(customType)}, description:${J(description)}, userIds:${JA(userIds)}, operatorIds:${JA(operatorIds)}){ channel_url name custom_type } }`;
    return (await this.gql(q)).messengerCreateChannel;
  }
  async getMessages(channelUrl, limit = 30) {
    const q = `{ messengerMessages(channelUrl:${J(channelUrl)}, limit:${limit}){ message_id message user{ user_id nickname is_bot } parent_message_id created_at } }`;
    return (await this.gql(q)).messengerMessages || [];
  }
  async getThread(parentMessageId) {
    const q = `{ messengerThreadMessages(parentMessageId:${J(parentMessageId)}){ message_id message user{ nickname } created_at } }`;
    return (await this.gql(q)).messengerThreadMessages || [];
  }
  async getChannel(channelUrl) {
    const q = `{ messengerChannel(channelUrl:${J(channelUrl)}){ channel_url name custom_type member_count members{ user_id nickname is_bot } } }`;
    return (await this.gql(q)).messengerChannel;
  }
  async myChannels() {
    const q = `{ messengerMyChannels(userId:${J(this.userId)}){ channel_url name custom_type member_count } }`;
    return (await this.gql(q)).messengerMyChannels || [];
  }
  async invite(channelUrl, userIds) {
    const q = `mutation{ messengerInviteMembers(channelUrl:${J(channelUrl)}, userIds:${JA(userIds)}) }`;
    return (await this.gql(q)).messengerInviteMembers;
  }
  async acceptInvite(channelUrl) {
    const q = `mutation{ messengerAcceptInvitation(channelUrl:${J(channelUrl)}, userId:${J(this.userId)}) }`;
    return (await this.gql(q)).messengerAcceptInvitation;
  }
  async setRole(channelUrl, userId, role) {
    const q = `mutation{ messengerUpdateMemberRole(channelUrl:${J(channelUrl)}, userId:${J(userId)}, role:${J(role)}) }`;
    return (await this.gql(q)).messengerUpdateMemberRole;
  }
  async ban(channelUrl, userId) {
    const q = `mutation{ messengerBanMember(channelUrl:${J(channelUrl)}, userId:${J(userId)}) }`;
    return (await this.gql(q)).messengerBanMember;
  }

  // ---- HTTP surface: Community / Feed (token ARG) ----
  async joinOpenGroup(url) {
    const q = `mutation{ joinOpenGroup(token:${J(this.token)}, url:${J(url)}){ isSuccess msg channel } }`;
    return (await this.gql(q)).joinOpenGroup;
  }
  async requestToJoin(url) {
    const q = `mutation{ requestToJoinGroup(token:${J(this.token)}, url:${J(url)}){ isSuccess msg channel } }`;
    return (await this.gql(q)).requestToJoinGroup;
  }
  async homegroups(grouping = "") {
    const q = `{ homegroups(token:${J(this.token)}, grouping:${J(grouping)}){ url name privacy members{ user_id nickname } } }`;
    return (await this.gql(q)).homegroups || [];
  }
  async homefeed() {
    const q = `{ homefeed(token:${J(this.token)}){ feed{ id msg user{ nickname } channel_url replycount } } }`;
    return (await this.gql(q)).homefeed;
  }
  async leaderboard() {
    const q = `{ leaderboard(token:${J(this.token)}){ currentProgress{ nickname progress } recentFinishers{ nickname } } }`;
    return (await this.gql(q)).leaderboard;
  }
  async botlist(channelUrl) {
    const q = `{ botlist(channel:${J(channelUrl)}){ id name enabled } }`;
    return (await this.gql(q)).botlist || [];
  }

  // ---- teardown (self) ----
  async signout() {
    const q = `mutation{ signout(token:${J(this.token)}) }`;
    try { return (await this.gql(q)).signout; } catch { return false; }
  }
}
