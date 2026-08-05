// GraphQL-over-HTTP helper for the study CLI.
//
// IMPORTANT: POST to the ROOT mount ("/"), never "/graphql". The backend's
// resolveLang() derives the request language from the LAST url path segment, so
// "/graphql" yields ctx.lang="graphql" (7 chars) which overflows
// bom_user.lang varchar(3) on any write (signup → ER_DATA_TOO_LONG). "/" → the
// empty trailing segment → "en". See docs/specs/2026-08-04-study-cli-design.md.

const endpoint = (base) => base.replace(/\/+$/, "") + "/";

// JSON-encode a scalar for safe inlining into a GraphQL query string.
export const J = (v) => JSON.stringify(v ?? "");
// Encode a list of strings as a GraphQL list literal.
export const JA = (arr) => "[" + (arr || []).map((x) => JSON.stringify(x)).join(", ") + "]";

export async function gql(base, query, { token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  let res, json;
  try {
    res = await fetch(endpoint(base), { method: "POST", headers, body: JSON.stringify({ query }) });
  } catch (e) {
    throw new Error(`HTTP request failed (${base}): ${e.message}`);
  }
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(`Non-JSON response (HTTP ${res.status}) from ${base}`);
  }
  if (json.errors && json.errors.length) {
    const err = new Error("GraphQL: " + json.errors.map((e) => e.message).join(" | "));
    err.graphql = json.errors;
    throw err;
  }
  return json.data;
}
