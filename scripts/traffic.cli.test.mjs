import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRequest,
  fetchClicky,
  loadRepositoryEnv,
  parseArgs,
  redactSecrets,
} from './traffic.cli.mjs';

const env = { CLICKY_SITE_ID: '66488278', CLICKY_SITEKEY: 'super-secret-key' };

test('summary builds a credentialed JSON request without exposing credentials to argv', () => {
  const parsed = parseArgs(['summary', '--date', 'last-7-days', '--daily']);
  const { url, timeout } = buildRequest(parsed, env);
  assert.equal(url.origin + url.pathname, 'https://api.clicky.com/api/stats/4');
  assert.equal(url.searchParams.get('site_id'), '66488278');
  assert.equal(url.searchParams.get('sitekey'), 'super-secret-key');
  assert.equal(url.searchParams.get('output'), 'json');
  assert.equal(url.searchParams.get('date'), 'last-7-days');
  assert.equal(url.searchParams.get('daily'), '1');
  assert.equal(timeout, 15_000);
});

test('query supports API types, pagination, and repeatable filters', () => {
  const parsed = parseArgs([
    'query', '--type', 'actions-list', '--limit', '1000', '--page', '2',
    '--param', 'action_type=pageview', '--param', 'href=/home/feed',
  ]);
  const { url } = buildRequest(parsed, env);
  assert.equal(url.searchParams.get('type'), 'actions-list');
  assert.equal(url.searchParams.get('limit'), '1000');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('action_type'), 'pageview');
  assert.equal(url.searchParams.get('href'), '/home/feed');
});

test('secrets and reserved parameter overrides fail safely', () => {
  assert.throws(() => buildRequest(parseArgs(['summary']), { CLICKY_SITE_ID: '1' }), /CLICKY_SITEKEY/);
  assert.throws(
    () => buildRequest(parseArgs(['query', '--type', 'pages', '--param', 'sitekey=evil']), env),
    /cannot override sitekey/,
  );
  assert.equal(redactSecrets('bad super-secret-key response', ['super-secret-key']), 'bad [REDACTED] response');
});

test('fetchClicky parses JSON and rejects non-JSON responses', async () => {
  const request = buildRequest(parseArgs(['online']), env);
  const ok = await fetchClicky(request, async () => new Response('[{"type":"visitors-online"}]'));
  assert.deepEqual(ok, [{ type: 'visitors-online' }]);
  await assert.rejects(
    fetchClicky(request, async () => new Response('<html>error</html>', { status: 502 })),
    /non-JSON data/,
  );
});

test('repository env loading preserves explicitly exported values', () => {
  const priorSiteId = process.env.CLICKY_SITE_ID;
  const priorSitekey = process.env.CLICKY_SITEKEY;
  try {
    process.env.CLICKY_SITE_ID = 'shell-site';
    process.env.CLICKY_SITEKEY = 'shell-key';
    loadRepositoryEnv(process.env);
    assert.equal(process.env.CLICKY_SITE_ID, 'shell-site');
    assert.equal(process.env.CLICKY_SITEKEY, 'shell-key');
  } finally {
    if (priorSiteId === undefined) delete process.env.CLICKY_SITE_ID;
    else process.env.CLICKY_SITE_ID = priorSiteId;
    if (priorSitekey === undefined) delete process.env.CLICKY_SITEKEY;
    else process.env.CLICKY_SITEKEY = priorSitekey;
  }
});
