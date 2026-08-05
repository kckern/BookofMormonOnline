// Scenario playback — provision the scenario's users, connect their sockets,
// then run ordered steps through their HTTP+WS sessions. Supports YAML or JSON.
//
// Scenario shape:
//   users: [alice, bob, carol]
//   steps:
//     - { as: alice, do: group.create, name: "Alma 32", invite: [bob, carol], as_var: ch }
//     - { delay: 500 }
//     - { as: bob,   do: post, group: $ch, text: "hi all", as_var: greeting }
//     - { as: carol, do: react, id: $greeting, emoji: "🔥" }
// Any step param may reference an earlier value with $name ($last is the most
// recent posted message id; $group the default target set by group.create/join).

import { createRequire } from "module";
import fs from "fs";
import { SessionManager } from "./manager.mjs";
import { dispatch } from "./commands.mjs";

const require = createRequire("/home/bom/BookofMormonOnline/backend/");
const yaml = require("js-yaml");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function loadScenario(file) {
  const raw = fs.readFileSync(file, "utf8");
  return file.endsWith(".json") ? JSON.parse(raw) : yaml.load(raw);
}

export async function runScenario(base, file, { log = console.log, watch = false } = {}) {
  const scenario = loadScenario(file);
  const manager = new SessionManager(base);
  const ctx = { manager, vars: {}, log };

  log(`▶ scenario: ${file}`);
  const users = scenario.users || [];
  log(`  provisioning ${users.length} user(s): ${users.join(", ")}`);
  for (const u of users) await manager.provision(u);
  await manager.connectAll();
  log(`  sockets connected.`);

  if (watch) {
    for (const name of manager.list())
      manager.get(name).onEvent((e) => log(`    « ${name} ⇐ ${e.event}: ${JSON.stringify(e.payload).slice(0, 140)}`));
  }

  let i = 0;
  try {
    for (const step of scenario.steps || []) {
      i++;
      if (step.delay != null) { await sleep(step.delay); continue; }
      const { as, do: verb, delay, ...params } = step;
      if (!as || !verb) { log(`  [step ${i}] skipped (needs 'as' and 'do')`); continue; }
      const session = manager.get(as);
      try {
        await dispatch(ctx, verb, params, session);
      } catch (e) {
        log(`  ✗ [step ${i}] ${as} ${verb}: ${e.message}`);
        if (scenario.stopOnError) throw e;
      }
    }
    // brief grace so trailing socket broadcasts land before we tear down
    await sleep(scenario.settle ?? 800);
  } finally {
    manager.disconnectAll();
  }
  log(`✔ scenario complete (${i} steps). vars: ${JSON.stringify(ctx.vars)}`);
  return ctx.vars;
}
