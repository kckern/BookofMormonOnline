const { creds, ensureSignedIn } = require('./auth');

const TEST_ENV = {
  TEST_USERNAME: 'regressiontest',
  TEST_PASSWORD: 'pw',
  TEST_SESSION_TOKEN: 'feedfacefeedfacefeedfacefeedface',
  TEST_NAME: 'Regression Test',
  TEST_EMAIL: 'bomtest+regression@example.com',
  TEST_ZIP: '84604',
};

describe('auth', () => {
  const saved = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(TEST_ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  });
  afterEach(() => {
    for (const k of Object.keys(TEST_ENV)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  test('creds throws a setup hint when env is missing', () => {
    delete process.env.TEST_USERNAME;
    expect(() => creds()).toThrow(/\.env\.test/);
  });

  test('returns the session token when signin succeeds', async () => {
    const post = async () => ({ status: 200, data: { data: { signin: { isSuccess: true } } } });
    const target = { name: 'prod', base: 'https://x', sandbox: false };
    await expect(ensureSignedIn(target, { post })).resolves.toBe(TEST_ENV.TEST_SESSION_TOKEN);
  });

  test('falls back to signup, then signs in', async () => {
    const sent = [];
    const post = async (url, query) => {
      sent.push(query);
      if (query.includes('signup')) return { status: 200, data: { data: { signup: { isSuccess: true } } } };
      // first signin fails, signin after signup succeeds
      const isRetry = sent.filter((q) => q.includes('signin')).length > 1;
      return { status: 200, data: { data: { signin: { isSuccess: isRetry } } } };
    };
    const target = { name: 'prod', base: 'https://x', sandbox: false };
    await expect(ensureSignedIn(target, { post })).resolves.toBe(TEST_ENV.TEST_SESSION_TOKEN);
    expect(sent.some((q) => q.includes('signup'))).toBe(true);
  });
});
