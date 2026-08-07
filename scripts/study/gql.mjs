// scripts/study/gql.mjs
// GraphQL-over-HTTP helper for the study CLI.
//
// IMPORTANT: POST to the ROOT mount ("/"), never "/graphql". The backend's
// resolveLang() derives the request language from the LAST url path segment, so
// "/graphql" yields ctx.lang="graphql" (7 chars) which overflows
// bom_user.lang varchar(3) on any write. "/" → the empty trailing segment → "en".

const endpoint = (base) => base.replace(/\/+$/, "") + "/";

export async function gql(base, query, { variables, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  const body = { query };
  if (variables) body.variables = variables;

  let res, json;
  try {
    res = await fetch(endpoint(base), { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`HTTP request failed (${base}): ${e.message}`);
  }
  try {
    json = await res.json();
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}) from ${base}`);
  }
  if (json.errors && json.errors.length) {
    const err = new Error("GraphQL: " + json.errors.map((e) => e.message).join(" | "));
    err.graphql = json.errors;
    throw err;
  }
  return json.data;
}
