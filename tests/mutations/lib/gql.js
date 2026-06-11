/**
 * Authenticated GraphQL client for the mutation suite.
 *
 * messenger* mutations identify the acting user from the Authorization: Bearer
 * header (resolveActingUserId); token-arg mutations (log, editProfile, joinGroup…)
 * read a `token` arg. This helper always sends the Bearer header and lets the
 * caller embed the token arg in the query as needed.
 */
const axios = require('axios');
const { baseUrl, langPath } = require('./config');

/**
 * Run a GraphQL operation. Returns { data, errors }.
 * @param {string} query - the GraphQL document (query or mutation).
 * @param {object} [opts] - { token: Bearer token, expectErrors: bool, lang: '/en' }
 */
async function gql(query, opts = {}) {
  const { token, lang = langPath } = opts;
  const headers = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await axios({
    method: 'post',
    url: baseUrl + lang,
    timeout: 30000,
    headers,
    data: { query },
    validateStatus: () => true,
  });
  const body = res.data || {};
  if (body.errors && body.errors.length && !opts.expectErrors) {
    const msg = body.errors.map((e) => e.message).join('; ');
    throw new Error(`GraphQL errors: ${msg}\n  query: ${query.replace(/\s+/g, ' ').slice(0, 120)}`);
  }
  return { data: body.data || {}, errors: body.errors || null };
}

/** Resolve a token → { user, userId(md5) } via tokensignin. */
async function whoami(token) {
  const { data } = await gql(
    `{ tokensignin(token:"${token}"){ isSuccess user { user } social { user_id nickname } } }`,
  );
  const t = data.tokensignin || {};
  return {
    isSuccess: !!t.isSuccess,
    user: t.user && t.user.user,
    userId: t.social && t.social.user_id,
    nickname: t.social && t.social.nickname,
  };
}

module.exports = { gql, whoami };
