// scripts/study/probe.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProbeArgs } from "./probe.mjs";

test("parseProbeArgs splits flags from the trailing query", () => {
  const r = parseProbeArgs(["--as", "alice", "--anon", "mutation{ x }"]);
  assert.equal(r.as, "alice");
  assert.equal(r.anon, true);
  assert.equal(r.query, "mutation{ x }");
});

test("multi-token query is rejoined", () => {
  const r = parseProbeArgs(["--as", "a", "query{", "__typename", "}"]);
  assert.equal(r.query, "query{ __typename }");
});
