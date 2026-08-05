// SessionManager — owns the roster of simulated users. Provisions each via the
// signup mutation with a client-generated token (idempotent: a persisted token
// is reused, and re-signup is a harmless upsert). Tokens/roster persist to a
// gitignored dotfile so re-runs reuse the same users.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { gql } from "./gql.mjs";
import { UserSession } from "./session.mjs";

// Portable: repo-relative (…/scripts/study/manager.mjs → repo/.study-cli), with
// a STUDY_CLI_HOME override. Never hardcode an absolute path.
const ROSTER_DIR = process.env.STUDY_CLI_HOME || fileURLToPath(new URL("../../.study-cli/", import.meta.url));
const ROSTER_FILE = path.join(ROSTER_DIR, "roster.json");
const PREFIX = "sim"; // synthetic users are always namespaced (alnum-only, cleanUsername-safe)

const genToken = () => "sim" + crypto.randomBytes(12).toString("hex"); // 27 chars, < varchar(32)
const md5 = (s) => crypto.createHash("md5").update(String(s)).digest("hex");
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
    this.createdChannels = this._loadCreated(); // string[] of channel_urls this tool created
  }

  _loadRoster() {
    try { return JSON.parse(fs.readFileSync(ROSTER_FILE, "utf8")); }
    catch { return {}; }
  }
  _saveRoster() {
    fs.mkdirSync(ROSTER_DIR, { recursive: true });
    fs.writeFileSync(ROSTER_FILE, JSON.stringify(this.roster, null, 2));
  }

  _loadCreated() {
    try { return JSON.parse(fs.readFileSync(path.join(ROSTER_DIR, "created.json"), "utf8")); }
    catch { return []; }
  }
  _saveCreated() {
    fs.mkdirSync(ROSTER_DIR, { recursive: true });
    fs.writeFileSync(path.join(ROSTER_DIR, "created.json"), JSON.stringify(this.createdChannels, null, 2));
  }
  recordChannel(channelUrl) {
    if (channelUrl && !this.createdChannels.includes(channelUrl)) { this.createdChannels.push(channelUrl); this._saveCreated(); }
  }

  // Provision (or reuse) a user. `name` is the short handle used in commands;
  // the real username is `sim_<name>`. Returns a connected-capable UserSession.
  async provision(name) {
    if (this.sessions.has(name)) return this.sessions.get(name);
    const username = simName(name);

    // Reuse a persisted, still-valid token; otherwise register a fresh one.
    // _tokenValid runs tokensignin, which ALSO provisions the messenger_users FK
    // row — so on the reuse path that single call is all we need. Only the fresh
    // path needs an explicit tokensignin after signup/signin.
    let token = this.roster[name]?.token;
    const reused = token ? await this._tokenValid(token) : false;
    if (!reused) {
      token = genToken();
      await this._register(username, name, token);
      try {
        await gql(this.base, `query($t:String){ tokensignin(token:$t){ isSuccess } }`, { variables: { t: token } });
      } catch (e) { console.warn(`  ⚠ tokensignin(${username}) failed: ${e.message} — socket auth may fail`); }
    }

    this.roster[name] = { username, token };
    this._saveRoster();
    const session = new UserSession(this.base, username, token);
    this.sessions.set(name, session);
    return session;
  }

  // Register `token` for `username`: signup creates the user; if the bom_user
  // already exists (ER_DUP_ENTRY), signin upserts the new token instead.
  async _register(username, name, token) {
    const signup = `mutation($t:String,$u:String,$n:String){ signup(token:$t, username:$u, password:"simpass", name:$n, email:"", zip:""){ isSuccess msg } }`;
    let res;
    try { res = (await gql(this.base, signup, { variables: { t: token, u: username, n: name } })).signup; } catch (e) { res = { isSuccess: false, msg: e.message }; }
    if (res.isSuccess) return;
    if (/ER_DATA_TOO_LONG/.test(res.msg || ""))
      throw new Error(`signup failed (${res.msg}): the CLI must POST to '/' not '/graphql'. Check --url.`);
    if (!/DUP/i.test(res.msg || ""))
      throw new Error(`signup failed for ${username}: ${res.msg}`);
    // Existing user → register this token via signin (a Query; verifies the sim password).
    const signin = `query($t:String,$u:String){ signin(token:$t, username:$u, password:"simpass"){ isSuccess msg } }`;
    let si;
    try { si = (await gql(this.base, signin, { variables: { t: token, u: username } })).signin; } catch (e) { si = { isSuccess: false, msg: e.message }; }
    if (!si.isSuccess) throw new Error(`signin for existing ${username} failed: ${si.msg}`);
  }

  async _tokenValid(token) {
    try {
      const q = `query($t:String){ tokensignin(token:$t){ isSuccess } }`;
      return !!(await gql(this.base, q, { variables: { t: token } })).tokensignin?.isSuccess;
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
  // Also removes sim members from any recorded scratch channels (no delete-channel
  // mutation exists, so "teardown" = empty the group of sim members).
  async cleanup() {
    // Best-effort: no delete-channel mutation exists, so empty the scratch
    // groups by removing every sim member, then revoke tokens.
    const simUserIds = Object.values(this.roster).map((r) => md5(r.username));
    for (const channelUrl of this.createdChannels) {
      // Any provisioned session can attempt the removals; operators succeed.
      for (const [name] of Object.entries(this.roster)) {
        let s;
        try { s = await this.provision(name); } catch { continue; }
        for (const uid of simUserIds) { try { await s.removeMember(channelUrl, uid); } catch { /* not operator / already gone */ } }
        break; // one session's attempt is enough
      }
    }
    const removed = [];
    for (const [, { username, token }] of Object.entries(this.roster)) {
      try { await gql(this.base, `mutation($t:String){ signout(token:$t) }`, { variables: { t: token } }); removed.push(username); } catch { /* ignore */ }
    }
    try { fs.rmSync(ROSTER_FILE, { force: true }); } catch { /* ignore */ }
    try { fs.rmSync(path.join(ROSTER_DIR, "created.json"), { force: true }); } catch { /* ignore */ }
    const emptied = this.createdChannels.length;
    this.roster = {}; this.createdChannels = []; this.disconnectAll(); this.sessions.clear();
    return { removed, emptied };
  }
}
