// scripts/study/groups.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeChannelUrl, resolveGroupRef } from "./groups.mjs";

const channels = [
  { channel_url: "aB3xYz90LmN", name: "Alma 32 study" },
  { channel_url: "Qk7rPd21Vwc", name: "Helaman reading" },
];

test("looksLikeChannelUrl recognises the opaque url shape, not names", () => {
  assert.equal(looksLikeChannelUrl("aB3xYz90LmN"), true);
  assert.equal(looksLikeChannelUrl("Alma 32 study"), false); // has a space
  assert.equal(looksLikeChannelUrl("alma"), false);          // too short / lowercase word
});

test("resolveGroupRef passes urls through unchanged", () => {
  assert.equal(resolveGroupRef("aB3xYz90LmN", channels), "aB3xYz90LmN");
});

test("resolveGroupRef matches a name case-insensitively by prefix", () => {
  assert.equal(resolveGroupRef("alma", channels), "aB3xYz90LmN");
  assert.equal(resolveGroupRef("Helaman reading", channels), "Qk7rPd21Vwc");
});

test("resolveGroupRef throws on no match and on ambiguous match", () => {
  assert.throws(() => resolveGroupRef("nope", channels), /no group/i);
  assert.throws(() => resolveGroupRef("a", [{ channel_url: "x", name: "Alma" }, { channel_url: "y", name: "Abish" }]), /ambiguous/i);
});
