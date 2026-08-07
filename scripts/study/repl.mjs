// Interactive REPL. `use <handle>` provisions+connects a user and makes it
// active; then type verbs (see commands.mjs). `watch` streams live socket
// events for the active user. Flags are `--key value`; a trailing quoted string
// maps to each verb's primary field (text / name / url). Lists: --invite a,b.

import readline from "readline";
import { SessionManager } from "./manager.mjs";
import { VERBS, dispatch } from "./commands.mjs";
import { tokenize, parseVerbArgs } from "./argparse.mjs";

export async function startRepl(base, { initialUser } = {}) {
  const manager = new SessionManager(base);
  const ctx = { manager, vars: {}, log: console.log };
  let active = null;
  let watching = false;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "study> " });
  const setPrompt = () => rl.setPrompt(active ? `${active}> ` : "study> ");

  const use = async (name) => {
    const s = await manager.provision(name);
    await s.connect();
    active = name;
    if (watching) s.onEvent((e) => console.log(`  « ${name} ⇐ ${e.event}: ${JSON.stringify(e.payload).slice(0, 140)}`));
    console.log(`  active user: ${name} (${s.userId})`);
    setPrompt();
  };

  console.log(`study CLI REPL — backend ${base}`);
  console.log(`  use <handle> | who | watch | help | <verb> ... | exit`);
  if (initialUser) { try { await use(initialUser); } catch (e) { console.log("  " + e.message); } }
  rl.prompt();

  let closed = false, eof = false, done = false, resolveFn;
  const result = new Promise((r) => (resolveFn = r));
  const finish = () => {
    if (done) return;
    done = true; closed = true;
    try { rl.close(); } catch { /* already closed */ }
    manager.disconnectAll();
    console.log("bye.");
    resolveFn();
  };

  const handleLine = async (line) => {
    const tokens = tokenize(line.trim());
    const verb = tokens.shift();
    if (!verb) return;
    if (verb === "exit" || verb === "quit") return "exit";
    if (verb === "help") { console.log("verbs: " + Object.keys(VERBS).join(", ") + "\n" + Object.entries(VERBS).map(([k, v]) => `  ${k} — ${v.help}`).join("\n")); return; }
    if (verb === "use") return use(tokens[0]);
    if (verb === "who") { console.log(`  users: ${manager.list().join(", ") || "(none)"}${active ? ` | active: ${active}` : ""} | vars: ${JSON.stringify(ctx.vars)}`); return; }
    if (verb === "watch") { watching = true; if (active) manager.get(active).onEvent((e) => console.log(`  « ${active} ⇐ ${e.event}: ${JSON.stringify(e.payload).slice(0, 140)}`)); console.log("  watching live socket events for active user."); return; }
    if (verb === "unwatch") { watching = false; if (active) manager.get(active).offEvent(); return; }
    if (!active) { console.log("  no active user — run: use <handle>"); return; }
    await dispatch(ctx, verb, parseVerbArgs(verb, tokens), manager.get(active));
  };

  // Strict sequential processing via a queue — piped input emits 'line' events
  // in a burst, so pause/resume can't prevent async commands from racing. A
  // worker drains one line at a time.
  const queue = [];
  let pumping = false;
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    while (queue.length && !done) {
      const line = queue.shift();
      try { if ((await handleLine(line)) === "exit") { eof = true; queue.length = 0; break; } }
      catch (e) { console.log("  ✗ " + e.message); }
      if (!eof && queue.length === 0) rl.prompt();
    }
    pumping = false;
    if (eof) finish();
  };
  rl.on("line", (line) => { queue.push(line); pump(); });
  // EOF (piped input / Ctrl-D): let the queue drain first, then tear down.
  rl.on("close", () => { eof = true; if (!pumping) finish(); });

  return result;
}
