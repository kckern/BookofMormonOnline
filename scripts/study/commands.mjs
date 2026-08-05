// Verb table shared by subcommands, the REPL, and scenario playback. Each verb
// receives (session, params, ctx). `params` is a plain object (flags from the
// REPL/CLI, or the step body from a scenario). `ctx` carries the manager, the
// shared variable bag (for $last / $name refs), and a log() sink.

const emoji = (e) => e || "👍";

// The send_message ack carries the persisted message ({ success:true, message }).
// Trust it — never fabricate an id by re-fetching (that reports a stale message
// as the new one when a send silently failed). emit() already throws on failure.
const messageIdFromAck = (ack) => {
  const id = ack && ack.message && ack.message.message_id;
  return id != null ? String(id) : null;
};

export const VERBS = {
  "group.create": {
    help: "create a group/channel — {name, type?, invite?:[handles]}",
    run: async (s, p, ctx) => {
      const invitees = (p.invite || []).map((h) => ctx.manager.get(h).userId);
      const ch = await s.createChannel({ name: p.name, customType: p.type || "group", description: p.description || "", userIds: invitees, operatorIds: [s.userId] });
      if (p.as_var) ctx.vars[p.as_var] = ch.channel_url;
      ctx.vars.group = ch.channel_url; // default target for later steps
      ctx.log(`  group created: "${ch.name}" → ${ch.channel_url}`);
      return ch;
    },
  },
  post: {
    help: "send a message — {group?, text}",
    run: async (s, p, ctx) => {
      const ch = p.group || ctx.vars.group;
      const ack = await s.sendMessage(ch, p.text, p.extra || {});
      const id = messageIdFromAck(ack);
      ctx.vars.last = id;
      if (p.as_var) ctx.vars[p.as_var] = id;
      ctx.log(`  ${s.username} posted [${id}]: ${p.text}`);
      return id;
    },
  },
  reply: {
    help: "reply in a thread — {group?, to:$last, text}",
    run: async (s, p, ctx) => {
      const ch = p.group || ctx.vars.group;
      const parent = p.to || ctx.vars.last;
      const ack = await s.reply(ch, parent, p.text, p.extra || {});
      const id = messageIdFromAck(ack);
      ctx.vars.last = id;
      ctx.log(`  ${s.username} replied to [${parent}] → [${id}]: ${p.text}`);
      return id;
    },
  },
  edit: { help: "edit a message — {group?, id:$last, text}", run: async (s, p, ctx) => { const ch = p.group || ctx.vars.group; await s.editMessage(ch, p.id || ctx.vars.last, p.text); ctx.log(`  ${s.username} edited [${p.id || ctx.vars.last}]`); } },
  del: { help: "delete a message — {group?, id:$last}", run: async (s, p, ctx) => { const ch = p.group || ctx.vars.group; await s.deleteMessage(ch, p.id || ctx.vars.last); ctx.log(`  ${s.username} deleted [${p.id || ctx.vars.last}]`); } },
  react: { help: "react — {group?, id:$last, emoji}", run: async (s, p, ctx) => { const ch = p.group || ctx.vars.group; await s.addReaction(ch, p.id || ctx.vars.last, emoji(p.emoji)); ctx.log(`  ${s.username} reacted ${emoji(p.emoji)} to [${p.id || ctx.vars.last}]`); } },
  unreact: { help: "remove reaction — {group?, id:$last, emoji}", run: async (s, p, ctx) => { const ch = p.group || ctx.vars.group; await s.removeReaction(ch, p.id || ctx.vars.last, emoji(p.emoji)); } },
  typing: { help: "typing indicator — {group?, on?:true}", run: async (s, p, ctx) => { const ch = p.group || ctx.vars.group; (p.on === false ? s.typingStop(ch) : s.typingStart(ch)); } },
  read: { help: "mark channel read — {group?}", run: async (s, p, ctx) => { await s.markRead(p.group || ctx.vars.group); } },

  msgs: {
    help: "list recent messages — {group?, limit?}",
    run: async (s, p, ctx) => {
      const msgs = await s.getMessages(p.group || ctx.vars.group, p.limit || 20);
      for (const m of msgs) {
        const replies = m.thread_info && m.thread_info.reply_count ? ` (${m.thread_info.reply_count} replies)` : "";
        ctx.log(`  [${m.message_id}] ${m.user?.nickname || m.user?.user_id}${m.user?.is_bot ? "🤖" : ""}: ${(m.message || "").slice(0, 100)}${replies}`);
      }
      return msgs;
    },
  },
  thread: { help: "list a thread — {parent:$last}", run: async (s, p, ctx) => { const t = await s.getThread(p.parent || ctx.vars.last); for (const m of t) ctx.log(`    ↳ ${m.user?.nickname}: ${(m.message || "").slice(0, 100)}`); return t; } },
  channel: { help: "channel info — {group?}", run: async (s, p, ctx) => { const c = await s.getChannel(p.group || ctx.vars.group); ctx.log(`  ${c?.name} (${c?.custom_type}) members=${c?.member_count}`); return c; } },
  mychannels: { help: "my channels", run: async (s, _p, ctx) => { const c = await s.myChannels(); for (const x of c) ctx.log(`  ${x.channel_url}  ${x.name} (${x.custom_type})`); return c; } },

  join: { help: "join an open group — {url}", run: async (s, p, ctx) => { const r = await s.joinOpenGroup(p.url); if (r?.channel) ctx.vars.group = r.channel; ctx.log(`  ${s.username} join → ${r?.msg || r?.isSuccess} (${r?.channel || ""})`); return r; } },
  request: { help: "request to join — {url}", run: async (s, p, ctx) => { const r = await s.requestToJoin(p.url); ctx.log(`  ${s.username} request → ${r?.msg || r?.isSuccess}`); return r; } },
  invite: { help: "invite members — {group?, users:[handles]}", run: async (s, p, ctx) => { const ids = (p.users || []).map((h) => ctx.manager.get(h).userId); const r = await s.invite(p.group || ctx.vars.group, ids); ctx.log(`  invited ${p.users?.join(", ")} → ${r}`); return r; } },
  accept: { help: "accept invitation — {group?}", run: async (s, p, ctx) => s.acceptInvite(p.group || ctx.vars.group) },
  role: { help: "set member role — {group?, user, role}", run: async (s, p, ctx) => s.setRole(p.group || ctx.vars.group, ctx.manager.get(p.user).userId, p.role) },
  ban: { help: "ban a member — {group?, user}", run: async (s, p, ctx) => s.ban(p.group || ctx.vars.group, ctx.manager.get(p.user).userId) },

  feed: { help: "home feed", run: async (s, _p, ctx) => { const f = await s.homefeed(); for (const it of (f?.feed || []).slice(0, 15)) ctx.log(`  [${it.id}] ${it.user?.nickname}: ${(it.msg || "").slice(0, 80)} (${it.replycount || 0} replies)`); return f; } },
  homegroups: { help: "list home groups", run: async (s, p, ctx) => { const g = await s.homegroups(p.grouping || ""); for (const x of g) ctx.log(`  ${x.url}  ${x.name} [${x.privacy}]`); return g; } },
  leaderboard: { help: "leaderboard", run: async (s, _p, ctx) => { const l = await s.leaderboard(); for (const u of (l?.currentProgress || []).slice(0, 10)) ctx.log(`  ${u.nickname}: ${u.progress}`); return l; } },
  bots: { help: "list bots — {group?}", run: async (s, p, ctx) => { const b = await s.botlist(p.group || ctx.vars.group); for (const x of b) ctx.log(`  ${x.id} ${x.name} enabled=${x.enabled}`); return b; } },

  events: { help: "dump this user's socket event log", run: async (s, _p, ctx) => { for (const e of s.events.slice(-30)) ctx.log(`  ${new Date(e.t).toISOString().slice(11, 19)} ${e.event} ${JSON.stringify(e.payload).slice(0, 120)}`); return s.events; } },
};

// Resolve $last / $var / literals in a scenario step's params. An unresolved
// $ref is a scenario bug (typo / wrong order) — throw rather than post to a
// channel literally named "$chh".
export function resolveRefs(params, vars) {
  const one = (v) => {
    if (typeof v === "string" && v.startsWith("$")) {
      const key = v.slice(1);
      if (!(key in vars)) throw new Error(`unresolved variable '${v}' — set it earlier via as_var, or use $last/$group`);
      return vars[key];
    }
    if (Array.isArray(v)) return v.map(one);
    return v;
  };
  const out = {};
  for (const [k, v] of Object.entries(params || {})) out[k] = one(v);
  return out;
}

export async function dispatch(ctx, verb, params, session) {
  const v = VERBS[verb] || VERBS[verb.replace(/^group$/, "group.create")];
  if (!v) throw new Error(`unknown verb '${verb}'. Try: ${Object.keys(VERBS).join(", ")}`);
  return v.run(session, resolveRefs(params, ctx.vars), ctx);
}
