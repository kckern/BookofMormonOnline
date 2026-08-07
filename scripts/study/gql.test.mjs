// scripts/study/gql.test.mjs
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { gql } from "./gql.mjs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("gql posts query + variables to the root mount and returns data", async () => {
  let seen;
  globalThis.fetch = async (url, opts) => {
    seen = { url, body: JSON.parse(opts.body), auth: opts.headers["authorization"] };
    return { json: async () => ({ data: { ok: 1 } }) };
  };
  const data = await gql("http://x", "query($a:Int){f(a:$a)}", { variables: { a: 3 }, token: "T" });
  assert.equal(seen.url, "http://x/");                 // root mount, not /graphql
  assert.deepEqual(seen.body, { query: "query($a:Int){f(a:$a)}", variables: { a: 3 } });
  assert.equal(seen.auth, "Bearer T");
  assert.deepEqual(data, { ok: 1 });
});

test("gql throws on GraphQL errors", async () => {
  globalThis.fetch = async () => ({ json: async () => ({ errors: [{ message: "boom" }] }) });
  await assert.rejects(() => gql("http://x", "{f}"), /GraphQL: boom/);
});
