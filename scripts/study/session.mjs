// UserSession — one simulated user's HTTP (GraphQL) + WebSocket (socket.io)
// presence. Everything the CLI does routes through a UserSession so the acting
// user is always explicit. Inbound socket events are buffered into a ring log
// and optionally streamed to a live watcher.

import { createRequire } from "module";
import crypto from "crypto";
import { gql } from "./gql.mjs";

// socket.io-client lives in the backend workspace (repo root has no manifest).
// Repo-relative so the tool is portable (…/scripts/study/ → repo/backend/).
const require = createRequire(new URL("../../backend/", import.meta.url));
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

  // HTTP as this user (bearer + optional variables).
  gql(query, variables) { return gql(this.base, query, { variables, token: this.token }); }

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
      // Small settle after 'connect': the server's connection handler (which
      // registers the message/reaction handlers) runs around the same time as
      // the client 'connect' event, so an emit fired instantly can still race it
      // and be dropped. ~250ms closes the window without user-visible latency.
      s.once("connect", () => setTimeout(() => resolve(this), 250));
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

  // Emit a client→server event. For ack-bearing events (default) resolve with
  // the server ack, THROW on {success:false} or on a missing ack (dropped) — a
  // test harness must never report a silent failure as success. Fire-and-forget
  // events (typing/read never ack) pass { expectAck:false } and don't park a timer.
  emit(event, payload, { expectAck = true } = {}) {
    if (!this.socket || !this.socket.connected)
      return Promise.reject(new Error(`[${this.username}] socket not connected (call connect first)`));
    if (!expectAck) { this.socket.emit(event, payload); return Promise.resolve(null); }
    return new Promise((resolve, reject) => {
      let done = false, timer;
      const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); fn(v); };
      this.socket.emit(event, payload, (ack) => {
        if (ack && ack.success === false) finish(reject, new Error(`${event} failed: ${ack.error || "unknown error"}`));
        else finish(resolve, ack ?? null);
      });
      timer = setTimeout(() => finish(reject, new Error(`${event}: no ack within 3s (backend dropped it?)`)), 3000);
    });
  }

  // ---- socket surface ----
  sendMessage(channelUrl, message, extra = {}) { return this.emit("send_message", { channelUrl, message, ...extra }); }
  reply(channelUrl, parentMessageId, message, extra = {}) { return this.emit("send_message", { channelUrl, message, parentMessageId, ...extra }); }
  editMessage(channelUrl, messageId, message) { return this.emit("edit_message", { channelUrl, messageId, message }); }
  deleteMessage(channelUrl, messageId) { return this.emit("delete_message", { channelUrl, messageId }); }
  // The reaction handler's payload field is `reactionKey`, not `reaction`.
  addReaction(channelUrl, messageId, reaction) { return this.emit("add_reaction", { channelUrl, messageId, reactionKey: reaction }); }
  removeReaction(channelUrl, messageId, reaction) { return this.emit("remove_reaction", { channelUrl, messageId, reactionKey: reaction }); }
  typingStart(channelUrl) { return this.emit("typing_start", { channelUrl }, { expectAck: false }); }
  typingStop(channelUrl) { return this.emit("typing_stop", { channelUrl }, { expectAck: false }); }
  markRead(channelUrl) { return this.emit("mark_read", { channelUrl }, { expectAck: false }); }

  // ---- HTTP surface: Messenger ----
  async createChannel({ name, customType = "group", description = "", userIds = [], operatorIds = [] }) {
    const q = `mutation($n:String,$ct:String,$d:String,$u:[String!],$o:[String]){ messengerCreateChannel(name:$n, customType:$ct, description:$d, userIds:$u, operatorIds:$o){ channel_url name custom_type } }`;
    return (await this.gql(q, { n: name, ct: customType, d: description, u: userIds, o: operatorIds })).messengerCreateChannel;
  }
  async getMessages(channelUrl, limit = 30) {
    const q = `query($c:String,$l:Int){ messengerMessages(channelUrl:$c, limit:$l){ message_id message user{ user_id nickname is_bot } parent_message_id thread_info{ reply_count } created_at } }`;
    return (await this.gql(q, { c: channelUrl, l: limit })).messengerMessages || [];
  }
  async getThread(parentMessageId) {
    const q = `query($p:String){ messengerThreadMessages(parentMessageId:$p){ message_id message user{ nickname } created_at } }`;
    return (await this.gql(q, { p: parentMessageId })).messengerThreadMessages || [];
  }
  async getChannel(channelUrl) {
    const q = `query($c:String){ messengerChannel(channelUrl:$c){ channel_url name custom_type member_count members{ user_id nickname is_bot } } }`;
    return (await this.gql(q, { c: channelUrl })).messengerChannel;
  }
  async myChannels() {
    const q = `query($u:String){ messengerMyChannels(userId:$u){ channel_url name custom_type member_count } }`;
    return (await this.gql(q, { u: this.userId })).messengerMyChannels || [];
  }
  async invite(channelUrl, userIds) {
    const q = `mutation($c:String,$u:[String]){ messengerInviteMembers(channelUrl:$c, userIds:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userIds })).messengerInviteMembers;
  }
  async acceptInvite(channelUrl) {
    const q = `mutation($c:String,$u:String){ messengerAcceptInvitation(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: this.userId })).messengerAcceptInvitation;
  }
  async setRole(channelUrl, userId, role) {
    const q = `mutation($c:String,$u:String,$r:String){ messengerUpdateMemberRole(channelUrl:$c, userId:$u, role:$r) }`;
    return (await this.gql(q, { c: channelUrl, u: userId, r: role })).messengerUpdateMemberRole;
  }
  async ban(channelUrl, userId) {
    const q = `mutation($c:String,$u:String){ messengerBanMember(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userId })).messengerBanMember;
  }
  async removeMember(channelUrl, userId) {
    const q = `mutation($c:String,$u:String){ messengerRemoveMember(channelUrl:$c, userId:$u) }`;
    return (await this.gql(q, { c: channelUrl, u: userId })).messengerRemoveMember;
  }

  // ---- HTTP surface: Community / Feed (token ARG) ----
  async joinOpenGroup(url) {
    const q = `mutation($t:String,$u:String){ joinOpenGroup(token:$t, url:$u){ isSuccess msg channel } }`;
    return (await this.gql(q, { t: this.token, u: url })).joinOpenGroup;
  }
  async requestToJoin(url) {
    const q = `mutation($t:String,$u:String){ requestToJoinGroup(token:$t, url:$u){ isSuccess msg channel } }`;
    return (await this.gql(q, { t: this.token, u: url })).requestToJoinGroup;
  }
  async homegroups(grouping = "") {
    const q = `query($t:String,$g:String){ homegroups(token:$t, grouping:$g){ url name privacy members{ user_id nickname } } }`;
    return (await this.gql(q, { t: this.token, g: grouping })).homegroups || [];
  }
  async homefeed() {
    const q = `query($t:String){ homefeed(token:$t){ feed{ id msg user{ nickname } channel_url replycount } } }`;
    return (await this.gql(q, { t: this.token })).homefeed;
  }
  async leaderboard() {
    const q = `query($t:String){ leaderboard(token:$t){ currentProgress{ nickname progress } recentFinishers{ nickname } } }`;
    return (await this.gql(q, { t: this.token })).leaderboard;
  }
  async botlist(channelUrl) {
    const q = `query($c:String){ botlist(channel:$c){ id name enabled } }`;
    return (await this.gql(q, { c: channelUrl })).botlist || [];
  }

  // ---- teardown (self) ----
  async signout() {
    const q = `mutation($t:String){ signout(token:$t) }`;
    try { return (await this.gql(q, { t: this.token })).signout; } catch { return false; }
  }
}
