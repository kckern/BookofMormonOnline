/**
 * Socket.io test client — the foundation for two-party ("ping-pong") realtime
 * tests. Each WsClient is one independent connection (one "browser"); a test
 * spins up two (sender + listener) and asserts that an action on one is pushed
 * to the other via the event bus, with no polling.
 *
 * Handshake auth is { userId, token } (server verifyToken). userId is the
 * messenger user_id (md5 of the bom username); we resolve it from the token.
 *
 * Server→client events asserted: message_received, message_updated,
 * message_deleted, reaction_changed, typing, unread_count_changed,
 * channel_action, user_joined.
 */
const { io } = require('socket.io-client');
const { socketUrl, socketPath } = require('./config');
const { whoami } = require('./gql');

class WsClient {
  constructor(label) {
    this.label = label;
    this.socket = null;
    this.userId = null;
    this._events = []; // rolling log of {event, payload, at}
    this._waiters = []; // active waitFor predicates
  }

  /** Connect + authenticate. Resolves once 'connect' fires (or rejects on error/timeout). */
  async connect(token, { timeout = 8000 } = {}) {
    const me = await whoami(token);
    if (!me.isSuccess || !me.userId) throw new Error(`${this.label}: token did not resolve to a user`);
    this.userId = me.userId;

    this.socket = io(socketUrl, {
      path: socketPath,
      transports: ['websocket'],
      auth: { userId: me.userId, token },
      reconnection: false,
      timeout,
    });

    // Record every inbound event so waitFor can match past-or-future.
    this.socket.onAny((event, payload) => {
      const rec = { event, payload, at: Date.now() };
      this._events.push(rec);
      this._waiters = this._waiters.filter((w) => {
        if (w.event === event && w.predicate(payload)) { w.resolve(payload); return false; }
        return true;
      });
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`${this.label}: connect timeout`)), timeout);
      this.socket.once('connect', () => { clearTimeout(t); resolve(); });
      this.socket.once('connect_error', (e) => { clearTimeout(t); reject(new Error(`${this.label}: ${e.message}`)); });
    });
    return this;
  }

  emit(event, payload) { this.socket.emit(event, payload); }

  /**
   * Resolve when `event` arrives matching `predicate` — checking events received
   * since `since` (default: now) so a fast push isn't missed by a late listener.
   */
  waitFor(event, predicate = () => true, { timeout = 8000, since = Date.now() } = {}) {
    const past = this._events.find((r) => r.event === event && r.at >= since && predicate(r.payload));
    if (past) return Promise.resolve(past.payload);
    return new Promise((resolve, reject) => {
      const w = { event, predicate, resolve };
      this._waiters.push(w);
      setTimeout(() => {
        this._waiters = this._waiters.filter((x) => x !== w);
        reject(new Error(`${this.label}: timed out waiting for '${event}'`));
      }, timeout);
    });
  }

  /** Events seen so far (for diagnostics). */
  seen(event) { return this._events.filter((r) => r.event === event).map((r) => r.payload); }

  disconnect() { if (this.socket) { this.socket.removeAllListeners(); this.socket.disconnect(); this.socket = null; } }
}

module.exports = { WsClient };
