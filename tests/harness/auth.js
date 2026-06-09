const { prepareQueries } = require('../../frontend/webapp/src/models/GraphQLQueries');
const { postQuery } = require('./client');
const { urlFor } = require('./targets');

function creds() {
  const {
    TEST_USERNAME, TEST_PASSWORD, TEST_SESSION_TOKEN, TEST_NAME, TEST_EMAIL, TEST_ZIP,
  } = process.env;
  if (!TEST_USERNAME || !TEST_PASSWORD || !TEST_SESSION_TOKEN || !TEST_EMAIL) {
    throw new Error('Missing test-user credentials: copy tests/.env.test.example to tests/.env.test and fill it in.');
  }
  return {
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    token: TEST_SESSION_TOKEN,
    name: TEST_NAME || 'Regression Test',
    email: TEST_EMAIL,
    zip: TEST_ZIP || '00000',
  };
}

// signin binds the client-supplied session token to the user; the token itself
// is the credential all gated queries use afterward.
async function ensureSignedIn(target, { post } = {}) {
  const c = creds();
  const opts = post ? { post } : {};
  const url = urlFor(target, 'en');
  const signinQuery = () =>
    prepareQueries({ signin: [{ username: c.username, password: c.password, token: c.token }] })[0].query;

  let body = await postQuery(url, signinQuery(), opts);
  if (body.data?.signin?.isSuccess) return c.token;

  const signupQuery = prepareQueries({
    signup: [{ token: c.token, username: c.username, password: c.password, name: c.name, email: c.email, zip: c.zip }],
  })[0].query;
  await postQuery(url, signupQuery, opts);

  body = await postQuery(url, signinQuery(), opts);
  if (!body.data?.signin?.isSuccess) {
    throw new Error(
      `Could not sign in or sign up test user "${c.username}" on ${target.name}: ${JSON.stringify(body).slice(0, 300)}`
    );
  }
  return c.token;
}

module.exports = { creds, ensureSignedIn };
