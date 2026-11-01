// scripts/test/bom-secrets-push.test.mjs
// Every run puts a fake `ssh` (and, for the Infisical path, a fake `curl`) first on PATH.
// Never run scripts/bom-secrets-push.sh without them: unstubbed it talks to production.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, '..', 'bom-secrets-push.sh')
const receiver = resolve(here, '..', '..', 'ops', 'production', 'secrets-receive.sh')
const b64 = (s) => Buffer.from(s).toString('base64')
const TWO = [{ secretKey: 'MYSQL_PASSWORD', secretValue: 'p w$' }, { secretKey: 'OPENAI_BOT_API_KEY', secretValue: 'sk-1' }]

// Fake ssh: call N appends the remote command to calls, saves argv to argv.N and stdin to
// stdin.N.<cmd> (unique per call, so a stale capture cannot mask a regression). Commands named
// in FAKE_FAIL exit 255; status answers FAKE_STATUS.
function stubs(secrets = TWO) {
  const d = mkdtempSync(join(tmpdir(), 'push-'))
  mkdirSync(join(d, 'xdg'))
  writeFileSync(join(d, 'ssh'), `#!/bin/sh
for a; do last="$a"; done
echo "$last" >> "${d}/calls"
n=$(wc -l < "${d}/calls" | tr -d ' ')
printf '%s\\n' "$@" > "${d}/argv.$n"
cat > "${d}/stdin.$n.$last"
case " \${FAKE_FAIL:-} " in *" $last "*) exit 255 ;; esac
[ "$last" = status ] && echo "\${FAKE_STATUS:-files=3}"
[ "$last" = put ] && echo stored=2
exit 0
`)
  chmodSync(join(d, 'ssh'), 0o755)
  writeFileSync(join(d, 'bundle.json'), JSON.stringify({ secrets }))
  return d
}
const run = (d, args, env = {}) => spawnSync('bash', [script, ...args], { encoding: 'utf8', timeout: 30000,
  env: { PATH: `${d}:${process.env.PATH}`, HOME: d, XDG_RUNTIME_DIR: join(d, 'xdg'), BOM_SECRETS_STATE_DIR: join(d, 'state'), BOM_SECRETS_TEST: '1',
    BOM_SECRETS_BUNDLE_JSON: join(d, 'bundle.json'), BOM_SECRETS_KEY: '/dev/null', ...env } })
const calls = (d) => existsSync(join(d, 'calls')) ? readFileSync(join(d, 'calls'), 'utf8').trim().split('\n') : []
const marker = (d) => join(d, 'state', 'bom-secrets-redeploy-pending')
// stdin of the single put call (fails if there was not exactly one)
function putStdin(d, as) {
  const f = readdirSync(d).filter((n) => /^stdin\.\d+\.put$/.test(n))
  assert.equal(f.length, 1, 'exactly one put')
  return readFileSync(join(d, f[0]), as)
}
const withStubs = (fn, secrets) => { const d = stubs(secrets); try { fn(d) } finally { rmSync(d, { recursive: true, force: true }) } }

test('parses as bash', () => { execFileSync('bash', ['-n', script]) })

test('push streams NAME<TAB>base64 lines plus the .END<TAB>N trailer and never prints values', () => withStubs((d) => {
  const r = run(d, ['push']); assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(putStdin(d, 'utf8').trim().split('\n'), [`MYSQL_PASSWORD\t${b64('p w$')}`, `OPENAI_BOT_API_KEY\t${b64('sk-1')}`, '.END\t2'])
  for (const v of ['sk-1', 'p w$', b64('sk-1')]) assert.ok(!r.stdout.includes(v) && !r.stderr.includes(v))
  assert.deepEqual(calls(d), ['put'])
}))

test('xtrace from the environment is switched off before any value is handled', () => withStubs((d) => {
  const r = run(d, ['push'], { SHELLOPTS: 'xtrace', BASH_XTRACEFD: '2' }); assert.equal(r.status, 0, r.stderr)
  for (const v of ['sk-1', b64('sk-1'), 'p w$', b64('p w$')]) assert.ok(!r.stderr.includes(v) && !r.stdout.includes(v), `${v} traced`)
}))

test('ssh pins the host key, ignores ssh config, and only put gets stdin', () => withStubs((d) => {
  assert.equal(run(d, ['status'], { BOM_SECRETS_KNOWN_HOSTS: '/kh' }).status, 0)
  assert.equal(run(d, ['push'], { BOM_SECRETS_KNOWN_HOSTS: '/kh' }).status, 0)
  const status = readFileSync(join(d, 'argv.1'), 'utf8').split('\n'), put = readFileSync(join(d, 'argv.2'), 'utf8').split('\n')
  for (const a of [status, put]) {
    const s = a.join(' ')
    for (const o of ['-F none', '-o StrictHostKeyChecking=yes', '-o UserKnownHostsFile=/kh', '-o HostKeyAlias=bom-prod',
      '-o BatchMode=yes', '-o IdentitiesOnly=yes', '-o ConnectTimeout=10', '-i /dev/null', '-T']) assert.ok(s.includes(o), o)
  }
  assert.ok(status.includes('-n') && !put.includes('-n'))
}))

test('known_hosts defaults to ~/.ssh/bom_secrets_known_hosts', () => withStubs((d) => {
  run(d, ['status'])
  assert.ok(readFileSync(join(d, 'argv.1'), 'utf8').includes(`UserKnownHostsFile=${d}/.ssh/bom_secrets_known_hosts`))
}))

test('ensure re-pushes and redeploys only when the box reports zero files', () => withStubs((d) => {
  assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=3' }).status, 0)
  assert.deepEqual(calls(d), ['status'])
  rmSync(join(d, 'calls'))
  assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=0' }).status, 0)
  assert.deepEqual(calls(d), ['status', 'put', 'redeploy'])
  assert.ok(!existsSync(marker(d)))
}))

test('ensure retries a failed redeploy on the next run even though files>0', () => withStubs((d) => {
  assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'files=0', FAKE_FAIL: 'redeploy' }).status, 0)
  assert.ok(existsSync(marker(d)), 'pending marker kept')
  assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=3' }).status, 0)
  assert.deepEqual(calls(d), ['status', 'put', 'redeploy', 'status', 'redeploy'])
  assert.ok(!existsSync(marker(d)), 'marker cleared after a successful redeploy')
  assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=3' }).status, 0)
  assert.deepEqual(calls(d).slice(5), ['status'])
  assert.equal(statSync(join(d, 'state')).mode & 0o777, 0o700, 'state dir is private')
  assert.deepEqual(readdirSync(join(d, 'xdg')), [], 'nothing in XDG_RUNTIME_DIR (tmpfs, lost on reboot)')
}))

test('the pending marker defaults to ~/.cache so it survives a homeserver reboot', () => withStubs((d) => {
  assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'files=0', FAKE_FAIL: 'redeploy', BOM_SECRETS_STATE_DIR: '' }).status, 0)
  assert.ok(existsSync(join(d, '.cache', 'bom-secrets-redeploy-pending')))
  assert.equal(statSync(join(d, '.cache')).mode & 0o777, 0o700)
}))

test('a successful manual redeploy or push-redeploy clears the pending marker; a failed one keeps it', () => withStubs((d) => {
  for (const cmd of ['redeploy', 'push-redeploy']) {
    mkdirSync(join(d, 'state'), { recursive: true }); writeFileSync(marker(d), '')
    assert.notEqual(run(d, [cmd], { FAKE_FAIL: 'redeploy' }).status, 0)
    assert.ok(existsSync(marker(d)), `${cmd} failed: marker kept`)
    assert.equal(run(d, [cmd]).status, 0)
    assert.ok(!existsSync(marker(d)), `${cmd} ok: marker cleared`)
  }
}))

test('ensure fails on an unexpected status reply instead of doing nothing', () => withStubs((d) => {
  assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'garbage' }).status, 0)
  assert.deepEqual(calls(d), ['status'])
}))

test('ensure fails when ssh fails on status and does nothing else', () => withStubs((d) => {
  assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'files=0', FAKE_FAIL: 'status' }).status, 0)
  assert.deepEqual(calls(d), ['status'])
}))

test('a failed put never leads to a redeploy', () => withStubs((d) => {
  assert.notEqual(run(d, ['push-redeploy'], { FAKE_FAIL: 'put' }).status, 0)
  assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'files=0', FAKE_FAIL: 'put' }).status, 0)
  assert.deepEqual(calls(d), ['put', 'status', 'put'])
}))

test('status, redeploy and push-redeploy route to the right remote commands', () => withStubs((d) => {
  const s = run(d, ['status']); assert.equal(s.status, 0, s.stderr); assert.equal(s.stdout.trim(), 'files=3')
  assert.equal(run(d, ['redeploy']).status, 0)
  assert.equal(run(d, ['push-redeploy']).status, 0)
  assert.deepEqual(calls(d), ['status', 'redeploy', 'put', 'redeploy'])
}))

test('unknown command or no command exits 64 without contacting the box', () => withStubs((d) => {
  for (const args of [['bogus'], []]) {
    const r = run(d, args); assert.equal(r.status, 64); assert.match(r.stderr, /usage/)
  }
  assert.deepEqual(calls(d), [])
}))

const many = Array.from({ length: 257 }, (_, i) => ({ secretKey: `V${i}`, secretValue: 'x' }))
for (const [label, body, why] of [
  ['invalid JSON', '{"secrets": [ {"secretKey": "A", "secretValue": "sk-leak'],
  ['zero secrets', '{"secrets":[]}', /zero secrets/],
  ['no secrets key', '{"message":"forbidden"}', /no secrets list/],
  ['secrets not an array', '{"secrets":"sk-leak"}', /no secrets list/],
  ['non-string value', '{"secrets":[{"secretKey":"A","secretValue":null}]}', /string name\/value/],
  ['name with a newline inside', '{"secrets":[{"secretKey":"A\\nB","secretValue":"sk-leak"}]}', /invalid variable name/],
  ['name with a trailing newline', '{"secrets":[{"secretKey":"A\\n","secretValue":"sk-leak"}]}', /invalid variable name/],
  ['reserved name BOM_*', '{"secrets":[{"secretKey":"BOM_X","secretValue":"sk-leak"}]}', /reserved variable name/],
  ['reserved name LD_PRELOAD', '{"secrets":[{"secretKey":"LD_PRELOAD","secretValue":"sk-leak"}]}', /reserved variable name/],
  ['reserved name PATH', '{"secrets":[{"secretKey":"PATH","secretValue":"sk-leak"}]}', /reserved variable name/],
  ['reserved name NODE_OPTIONS', '{"secrets":[{"secretKey":"NODE_OPTIONS","secretValue":"sk-leak"}]}', /reserved variable name/],
  ['duplicate name', '{"secrets":[{"secretKey":"A","secretValue":"sk-leak"},{"secretKey":"A","secretValue":"y"}]}', /duplicate/],
  ['more than 256 variables', JSON.stringify({ secrets: many }), /more than 256/],
  ['value too large', JSON.stringify({ secrets: [{ secretKey: 'A', secretValue: 'sk-leak' + 'x'.repeat(49200) }] }), /too large/],
  ['empty file', ''],
]) {
  test(`bad fetch (${label}) exits non-zero and never calls ssh put`, () => withStubs((d) => {
    writeFileSync(join(d, 'bundle.json'), body)
    for (const cmd of ['push', 'push-redeploy']) {
      const r = run(d, [cmd]); assert.notEqual(r.status, 0, cmd)
      if (why) assert.match(r.stderr, why)
      assert.ok(!r.stdout.includes('sk-leak') && !r.stderr.includes('sk-leak'), 'value leaked to output')
    }
    assert.deepEqual(calls(d), [])
    const e = run(d, ['ensure'], { FAKE_STATUS: 'files=0' }); assert.notEqual(e.status, 0)
    assert.deepEqual(calls(d), ['status'], 'ensure must not put or redeploy after a failed fetch')
  }))
}

test('the largest allowed value (65536 base64 chars) is accepted', () => withStubs((d) => {
  assert.equal(run(d, ['push']).status, 0)
}, [{ secretKey: 'BIG', secretValue: 'x'.repeat(49152) }]))

test('missing bundle file exits non-zero and never calls ssh', () => withStubs((d) => {
  const r = run(d, ['push'], { BOM_SECRETS_BUNDLE_JSON: join(d, 'nope.json') })
  assert.notEqual(r.status, 0); assert.deepEqual(calls(d), [])
}))

test('round trip through the real receiver stores the exact value bytes', () => {
  const values = {
    MYSQL_PASSWORD: 'p w$ "q" \'s\' `b` \\ %s %%',
    MULTILINE: 'line1\nline2\n\n',
    TRAILING_NL: 'x\n',
    UNICODE: 'héllo wörld ✓ 日本語 🔑',
    TABS: 'a\tb\t',
    CTRL: '\u0001\u001b[0m\r\n',
    LEADING_SPACE: '  padded  ',
    DASHES: '-n -e --',
  }
  withStubs((d) => {
    const r = run(d, ['push']); assert.equal(r.status, 0, r.stderr)
    const root = join(d, 'box', 'bom-secrets'); mkdirSync(join(d, 'box'))
    const rcv = spawnSync('sh', [receiver], { input: putStdin(d), encoding: 'utf8', timeout: 30000,
      env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: 'put', BOM_SECRETS_ROOT: root, BOM_SECRETS_SKIP_TMPFS_CHECK: '1' } })
    assert.equal(rcv.status, 0, rcv.stderr)
    assert.equal(rcv.stdout.trim(), `stored=${Object.keys(values).length}`)
    assert.deepEqual(readdirSync(root).sort(), Object.keys(values).sort())
    for (const [k, v] of Object.entries(values)) {
      assert.ok(readFileSync(join(root, k)).equals(Buffer.from(v, 'utf8')), `${k} bytes differ`)
    }
  }, Object.entries(values).map(([secretKey, secretValue]) => ({ secretKey, secretValue })))
})

// Fake curl for the real Infisical path: logs argv and stdin per call, answers login then secrets.
function infisicalStubs({ login = `echo '{"accessToken":"tok-leak"}'`, secrets = 'cat "$D/bundle.json"' } = {}) {
  const d = stubs()
  const id = join(d, 'infisical'); mkdirSync(id)
  writeFileSync(join(id, '.client-id'), 'cid-123\n')
  writeFileSync(join(id, '.client-secret'), 'csec-leak\n')
  writeFileSync(join(id, '.prod-project-id'), 'proj-1\n')
  writeFileSync(join(d, 'curl'), `#!/bin/sh
D="${d}"
n=$(ls "$D" | grep -c '^curl-argv') ; n=$((n + 1))
printf '%s\\n' "$@" > "$D/curl-argv.$n"; cat > "$D/curl-stdin.$n"
case "$*" in
  *universal-auth/login*) ${login} ;;
  *secrets/raw*) ${secrets} ;;
  *) exit 99 ;;
esac
`)
  chmodSync(join(d, 'curl'), 0o755)
  return [d, { BOM_SECRETS_TEST: '', BOM_SECRETS_BUNDLE_JSON: '', BOM_INFISICAL_DIR: id, BOM_INFISICAL_HOST: 'http://infisical.test' }]
}
const withInfisical = (opts, fn) => { const [d, env] = infisicalStubs(opts); try { fn(d, env) } finally { rmSync(d, { recursive: true, force: true }) } }

test('real Infisical path: login then raw secrets, credentials and token only on stdin', () => withInfisical({}, (d, env) => {
  const r = run(d, ['push'], env); assert.equal(r.status, 0, r.stderr)
  const argv1 = readFileSync(join(d, 'curl-argv.1'), 'utf8'), argv2 = readFileSync(join(d, 'curl-argv.2'), 'utf8')
  for (const a of [argv1, argv2]) assert.equal(a.split('\n')[0], '-q', 'curl -q comes first (no ~/.curlrc)')
  assert.match(argv1, /http:\/\/infisical\.test\/api\/v1\/auth\/universal-auth\/login/)
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'curl-stdin.1'), 'utf8')), { clientId: 'cid-123', clientSecret: 'csec-leak' })
  assert.match(argv2, /http:\/\/infisical\.test\/api\/v3\/secrets\/raw/)
  for (const p of ['environment=prod', 'secretPath=/bom-runtime', 'workspaceId=proj-1', 'expandSecretReferences=true']) assert.ok(argv2.includes(p), p)
  assert.equal(readFileSync(join(d, 'curl-stdin.2'), 'utf8'), 'header = "Authorization: Bearer tok-leak"\n')
  for (const a of [argv1, argv2, r.stdout, r.stderr]) assert.ok(!/csec-leak|tok-leak|sk-1/.test(a), 'credential in argv/output')
  assert.equal(putStdin(d, 'utf8').trim().split('\n').at(-1), '.END\t2')
}))

test('the canned-JSON hook is ignored unless BOM_SECRETS_TEST=1', () => withInfisical({}, (d, env) => {
  writeFileSync(join(d, 'other.json'), JSON.stringify({ secrets: [{ secretKey: 'HOOK', secretValue: 'h' }] }))
  const r = run(d, ['push'], { ...env, BOM_SECRETS_BUNDLE_JSON: join(d, 'other.json') }); assert.equal(r.status, 0, r.stderr)
  assert.ok(existsSync(join(d, 'curl-argv.2')), 'went to Infisical')
  assert.ok(!putStdin(d, 'utf8').includes('HOOK'))
}))

for (const [label, login] of [
  ['login HTTP error', 'echo "curl: (22) 401" >&2; exit 22'],
  ['empty token', `echo '{"accessToken":""}'`],
  ['token with a quote', `echo '{"accessToken":"a\\\\"b"}'`],
  ['no token field', `echo '{"message":"nope"}'`],
]) {
  test(`real Infisical path: ${label} exits non-zero, no secrets request, no ssh`, () => withInfisical({ login }, (d, env) => {
    const r = run(d, ['push'], env); assert.notEqual(r.status, 0)
    assert.ok(existsSync(join(d, 'curl-argv.1')), 'login attempted')
    assert.ok(!existsSync(join(d, 'curl-argv.2')), 'no secrets request without a usable token')
    assert.deepEqual(calls(d), [])
  }))
}

test('real Infisical path: failed secrets fetch exits non-zero and never calls ssh', () => withInfisical(
  { secrets: 'echo "curl: (22) 403" >&2; exit 22' }, (d, env) => {
    const r = run(d, ['push-redeploy'], env); assert.notEqual(r.status, 0)
    assert.ok(existsSync(join(d, 'curl-argv.2')))
    assert.deepEqual(calls(d), [])
  }))
