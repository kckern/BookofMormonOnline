const { wrapCompound, postQuery } = require('./client');

describe('wrapCompound', () => {
  test('wraps plain queries in braces (mirrors BoMOnlineAPI.js:39)', () => {
    expect(wrapCompound('person (slug: "nephi"){ slug }')).toBe('{person (slug: "nephi"){ slug }}');
  });

  test('unwraps mutations (mirrors BoMOnlineAPI.js:40)', () => {
    expect(wrapCompound('mutation signout{ signout( token: "x" ) } '))
      .toBe('mutation signout{ signout( token: "x" ) } ');
  });
});

describe('postQuery', () => {
  test('returns a GraphQL body on success', async () => {
    const post = async () => ({ status: 200, data: { data: { labels: [] } } });
    await expect(postQuery('http://x/en', '{labels{key}}', { post }))
      .resolves.toEqual({ data: { labels: [] } });
  });

  test('retries once on transport failure', async () => {
    let calls = 0;
    const post = async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return { status: 200, data: { data: { ok: true } } };
    };
    await expect(postQuery('http://x/en', '{q}', { post })).resolves.toEqual({ data: { ok: true } });
    expect(calls).toBe(2);
  });

  test('rejects non-GraphQL bodies (e.g. proxy HTML error pages)', async () => {
    const post = async () => ({ status: 404, data: '<!DOCTYPE html>Cannot POST /' });
    await expect(postQuery('http://x/en', '{q}', { post })).rejects.toThrow(/Non-GraphQL response/);
  });

  test('keeps bodies that carry GraphQL errors — error behavior is contract', async () => {
    const post = async () => ({ status: 400, data: { errors: [{ message: 'bad field' }] } });
    await expect(postQuery('http://x/en', '{q}', { post }))
      .resolves.toEqual({ errors: [{ message: 'bad field' }] });
  });
});
