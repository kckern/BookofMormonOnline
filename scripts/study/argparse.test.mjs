// scripts/study/argparse.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize, parseVerbArgs } from "./argparse.mjs";

test("tokenize respects quotes", () => {
  assert.deepEqual(tokenize(`post --group X "hello world"`), ["post", "--group", "X", "hello world"]);
});

test("parseVerbArgs maps a bare trailing string to the verb's primary field", () => {
  assert.deepEqual(parseVerbArgs("post", ["hello", "world"]), { text: "hello world" });
  assert.deepEqual(parseVerbArgs("group.create", ["My", "Group"]), { name: "My Group" });
});

test("parseVerbArgs parses --flags and splits list flags", () => {
  assert.deepEqual(parseVerbArgs("invite", ["--users", "a,b,c"]), { users: ["a", "b", "c"] });
  assert.deepEqual(parseVerbArgs("post", ["--group", "X", "hi"]), { group: "X", text: "hi" });
});

test("a bare --flag with no value is boolean true", () => {
  assert.deepEqual(parseVerbArgs("typing", ["--on"]), { on: true });
});
