// SessionManager — owns the roster of simulated users. Provisions each via the
// signup mutation with a client-generated token (idempotent: a persisted token
// is reused, and re-signup is a harmless upsert). Tokens/roster persist to a
// gitignored dotfile so re-runs reuse the same users.

import { createRequire } from "module";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { gql, J } from "./gql.mjs";
import { UserSession } from "./session.mjs";

const require = createRequire("/home/bom/BookofMormonOnline/backend/");

const ROSTER_DIR = "/home/bom/BookofMormonOnline/.study-cli";
const ROSTER_FILE = path.join(ROSTER_DIR, "roster.json");
const PREFIX = "sim"; // synthetic users are always namespaced (alnum-only, cleanUsername-safe)

const genToken = () => "sim" + crypto.randomBytes(12).toString("hex"); // 27 chars, < varchar(32)
// Canonical, alphanumeric-only username so the server's cleanUsername() is a
// no-op and md5(username) === the messenger user_id. Underscores/dots would be
// rewritten (sim_alice → sim.alice), breaking the user_id match.
const simName = (name) => {
  const h = String(name).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return h.startsWith(PREFIX) ? h : PREFIX + h;
};

export class SessionManager {
  constructor(base) {
    this.base = base;
    this.sessions = new Map(); // shortName -> UserSession
    this.roster = this._loadRoster(); // shortName -> { username, token }
  }

  _loadRoster() {
    try { return JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8")); }
    catch { return {}; }
  }
  _saveRoster() {
    fs.mkdirSync(ROSTER_DIR, { recursive: true });
    fs.writeFileSync(ROSTER_FILE, JSON.stringify(this.roster, null, 2));
  }

  // Provision (or reuse) a user. `name` is the short handle used in commands;
  // the real username is `sim_<name>`. Returns a connected-capable UserSession.
  async provision(name) {
    if (this.sessions.has(name)) return this.sessions.get(name);
    const username = simName(name);

    // Reuse a persisted, still-valid token; otherwise register a fresh one.
    let token = this.roster[name]?.token;
    if (!(token && (await this._tokenValid(token)))) {
      token = genToken();
      await this._register(username, name, token);
    }

    // messenger_users (FK-required for socket auth + messaging) is provisioned
    // on tokensignin, NOT signup — call it so the handshake recognises the user.
    try { await gql(this.base, `{ tokensignin(token:${J(token)}){ isSuccess } }`); } catch { /* non-fatal */ }

    this.roster[name] = { username, token };
    this._saveRoster();
    const session = new UserSession(this.base, username, token);
    this.sessions.set(name, session);
    return session;
  }

  // Register `token` for `username`: signup creates the user; if the bom_user
  // already exists (ER_DUP_ENTRY), signin upserts the new token instead.
  async _register(username, name, token) {
    const signup = `mutation{ signup(token:${J(token)}, username:${J(username)}, password:"simpass", name:${J(name)}, email:"", zip:""){ isSuccess msg } }`;
    let res;
    try { res = (await gql(this.base, signup)).signup; } catch (e) { res = { isSuccess: false, msg: e.message }; }
    if (res.isSuccess) return;
    if (/ER_DATA_TOO_LONG/.test(res.msg || ""))
      throw new Error(`signup failed (${res.msg}): the CLI must POST to '/' not '/graphql'. Check --url.`);
    if (!/DUP/i.test(res.msg || ""))
      throw new Error(`signup failed for ${username}: ${res.msg}`);
    // Existing user → register this token via signin (a Query; verifies the sim password).
    const signin = `{ signin(token:${J(token)}, username:${J(username)}, password:"simpass"){ isSuccess msg } }`;
    let si;
    try { si = (await gql(this.base, signin)).signin; } catch (e) { si = { isSuccess: false, msg: e.message }; }
    if (!si.isSuccess) throw new Error(`signin for existing ${username} failed: ${si.msg}`);
  }

  async _tokenValid(token) {
    try {
      const q = `{ tokensignin(token:${J(token)}){ isSuccess } }`;
      return !!(await gql(this.base, q)).tokensignin?.isSuccess;
    } catch { return false; }
  }

  get(name) {
    const s = this.sessions.get(name);
    if (!s) throw new Error(`user '${name}' not provisioned — add it to the scenario 'users' or 'use' it first`);
    return s;
  }

  list() { return [...this.sessions.keys()]; }

  async connectAll() { await Promise.all(this.list().map((n) => this.sessions.get(n).connect())); }
  disconnectAll() { for (const s of this.sessions.values()) s.disconnect(); }

  // Remove every sim user's token (bom_user_token row) via signout, and forget
  // the local roster. bom_user rows remain (harmless, namespaced sim_*).
  async cleanup() {
    const removed = [];
    for (const [name, { username, token }] of Object.entries(this.roster)) {
      try { await gql(this.base, `mutation{ signout(token:${J(token)}) }`); removed.push(username); } catch { /* ignore */ }
    }
    try { fs.rmSync(ROSTER_FILE, { force: true }); } catch { /* ignore */ }
    this.roster = {}; this.disconnectAll(); this.sessions.clear();
    return removed;
  }
}
