#!/usr/bin/env node
// study.cli.mjs — multi-user study-group / community simulator.
//
// Drives the full Messenger + Community + Feed surface (HTTP GraphQL + socket.io)
// as multiple synthetic users, for ad-hoc testing and conversation simulation.
// Design: docs/specs/2026-08-04-study-cli-design.md
//
// Usage:
//   node scripts/study.cli.mjs repl [--as <handle>]          interactive shell
//   node scripts/study.cli.mjs run <scenario.yaml|json>      play a scenario
//   node scripts/study.cli.mjs <verb> --as <handle> [flags]  one-shot command
//   node scripts/study.cli.mjs users                         list provisioned users
//   node scripts/study.cli.mjs cleanup                       revoke sim_* tokens
//
// Backend URL: --url or $STUDY_CLI_URL (default http://localhost:5006).
// NOTE: the URL must be the ROOT of the GraphQL server; the CLI posts to "/",
// not "/graphql" (see gql.mjs for why).

import { SessionManager } from "./study/manager.mjs";
import { VERBS, dispatch } from "./study/commands.mjs";
import { startRepl } from "./study/repl.mjs";
import { runScenario } from "./study/scenario.mjs";
import { parseVerbArgs } from "./study/argparse.mjs";

function parseArgv(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out.flags[key] = key === "invite" || key === "users" ? val.split(",") : val;
    } else out._.push(t);
  }
  return out;
}

async function main() {
  const { _, flags } = parseArgv(process.argv.slice(2));
  const base = flags.url || process.env.STUDY_CLI_URL || "http://localhost:5006";
  const cmd = _[0];

  if (!cmd || cmd === "help") {
    console.log([
      "study.cli — multi-user community simulator",
      "  repl [--as <handle>]           interactive shell",
      "  run <scenario.yaml>            play a scenario (add --watch for live events)",
      "  <verb> --as <handle> [flags]   one-shot command",
      "  users | cleanup                roster management",
      "  --url <base>                   backend root (default http://localhost:5006)",
      "",
      "verbs:",
      ...Object.entries(VERBS).map(([k, v]) => `  ${k.padEnd(12)} ${v.help}`),
    ].join("\n"));
    return;
  }

  if (cmd === "repl") { await startRepl(base, { initialUser: flags.as }); return; }

  if (cmd === "run") {
    const file = _[1];
    if (!file) { console.error("run: needs a scenario file"); process.exit(2); }
    await runScenario(base, file, { watch: flags.watch === true || flags.watch === "true" });
    return;
  }

  const manager = new SessionManager(base);

  if (cmd === "users") { console.log(Object.entries(manager.roster).map(([n, r]) => `  ${n} → ${r.username}`).join("\n") || "  (roster empty)"); return; }
  if (cmd === "cleanup") { const { removed, emptied } = await manager.cleanup(); console.log(`revoked ${removed.length} sim token(s); emptied ${emptied} scratch group(s): ${removed.join(", ")}`); return; }

  // one-shot verb
  if (!VERBS[cmd] && cmd !== "group") { console.error(`unknown command '${cmd}'. Run: node scripts/study.cli.mjs help`); process.exit(2); }
  const as = flags.as;
  if (!as) { console.error(`${cmd}: needs --as <handle>`); process.exit(2); }
  const ctx = { manager, vars: {}, log: console.log };
  const session = await manager.provision(as);
  const needsSocket = ["post", "reply", "edit", "del", "react", "unreact", "typing", "read"].includes(cmd);
  try {
    if (needsSocket) await session.connect();
    // Re-parse the raw argv tail as verb args so `post --as alice "hi"` works
    // (the leading `--as <handle>` is consumed as a normal flag and ignored by verbs).
    const verbArgs = parseVerbArgs(cmd, process.argv.slice(3));
    await dispatch(ctx, cmd, verbArgs, session);
    if (needsSocket) await new Promise((r) => setTimeout(r, 600)); // let broadcast land
  } finally {
    session.disconnect();
  }
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
