// scripts/study/probe.mjs
// Raw authenticated GraphQL probe as a provisioned sim user — the dynamic-audit
// tool. Sends the given query with that user's bearer token (or none with --anon),
// so an auditor can test authz (e.g. alice's token + bob's userId arg).
//
//   node scripts/study/probe.mjs --as alice --uid bob \
//     'mutation{ messengerUpdateUser(userId:"<paste bob md5>", nickname:"pwned"){ user_id nickname } }'
//   node scripts/study/probe.mjs --as alice --anon 'mutation{ messengerCreateChannel(name:"anon"){ channel_url } }'

import { SessionManager } from "./manager.mjs";
import { gql } from "./gql.mjs";
import { md5 } from "./session.mjs";

// Flags that take a value argument; all others are treated as booleans.
const VALUE_FLAGS = new Set(["as", "uid", "url"]);

export function parseProbeArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const k = t.slice(2);
      if (VALUE_FLAGS.has(k) && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
        out[k] = argv[++i];
      } else {
        out[k] = true;
      }
    } else out._.push(t);
  }
  out.query = out._.join(" ");
  return out;
}

// Guard so importing for tests doesn't run the CLI.
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseProbeArgs(process.argv.slice(2));
  const base = a.url || process.env.STUDY_CLI_URL || "http://localhost:5006";
  if (!a.as || !a.query) { console.error('usage: probe.mjs --as <handle> [--anon] [--uid <handle>] "<graphql>"'); process.exit(2); }
  const mgr = new SessionManager(base);
  const session = await mgr.provision(a.as);
  if (a.uid) console.error(`# uid(${a.uid}) = ${md5((await mgr.provision(a.uid)).username)}`);
  const token = a.anon ? undefined : session.token;
  try { console.log(JSON.stringify(await gql(base, a.query, { token }), null, 2)); }
  catch (e) { console.log("ERROR: " + e.message); if (e.graphql) console.log(JSON.stringify(e.graphql, null, 2)); }
  mgr.disconnectAll();
}
