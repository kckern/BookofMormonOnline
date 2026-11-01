// scripts/test/bom-secrets-push.test.mjs
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, '..', 'bom-secrets-push.sh')
const receiver = resolve(here, '..', '..', 'ops', 'production', 'secrets-receive.sh')
const b64 = (s) => Buffer.from(s).toString('base64')

function stubs(secrets = [{ secretKey: 'MYSQL_PASSWORD', secretValue: 'p w$' }, { secretKey: 'OPENAI_BOT_API_KEY', secretValue: 'sk-1' }]) {
  const d = mkdtempSync(join(tmpdir(), 'push-'))
  // fake ssh: records the remote command and stdin, answers status
  writeFileSync(join(d, 'ssh'), `#!/bin/sh\nfor a; do last="$a"; done\necho "$last" >> "${d}/calls"\ncat > "${d}/stdin.$last"\n[ "$last" = status ] && echo "\${FAKE_STATUS:-files=3}"\n[ "$last" = put ] && echo stored=2\nexit 0\n`)
  chmodSync(join(d, 'ssh'), 0o755)
  writeFileSync(join(d, 'bundle.json'), JSON.stringify({ secrets }))
  return d
}
const run = (d, args, env = {}) => spawnSync('bash', [script, ...args], { encoding: 'utf8', timeout: 30000,
  env: { PATH: `${d}:${process.env.PATH}`, BOM_SECRETS_BUNDLE_JSON: join(d, 'bundle.json'), BOM_SECRETS_KEY: '/dev/null', ...env } })
const calls = (d) => existsSync(join(d, 'calls')) ? readFileSync(join(d, 'calls'), 'utf8').trim().split('\n') : []

test('parses as bash', () => { execFileSync('bash', ['-n', script]) })

test('push streams NAME<TAB>base64 lines plus the .END<TAB>N trailer and never prints values', () => {
  const d = stubs()
  try {
    const r = run(d, ['push']); assert.equal(r.status, 0, r.stderr)
    const lines = readFileSync(join(d, 'stdin.put'), 'utf8').trim().split('\n')
    assert.deepEqual(lines, [`MYSQL_PASSWORD\t${b64('p w$')}`, `OPENAI_BOT_API_KEY\t${b64('sk-1')}`, '.END\t2'])
    assert.ok(!r.stdout.includes('sk-1') && !r.stderr.includes('sk-1'))
    assert.ok(!r.stdout.includes('p w$') && !r.stderr.includes('p w$'))
    assert.deepEqual(calls(d), ['put'])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('ensure re-pushes and redeploys only when the box reports zero files', () => {
  const d = stubs()
  try {
    assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=3' }).status, 0)
    assert.deepEqual(calls(d), ['status'])
    rmSync(join(d, 'calls'))
    assert.equal(run(d, ['ensure'], { FAKE_STATUS: 'files=0' }).status, 0)
    assert.deepEqual(calls(d), ['status', 'put', 'redeploy'])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('ensure fails on an unexpected status reply instead of doing nothing', () => {
  const d = stubs()
  try {
    assert.notEqual(run(d, ['ensure'], { FAKE_STATUS: 'garbage' }).status, 0)
    assert.deepEqual(calls(d), ['status'])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('status, redeploy and push-redeploy route to the right remote commands', () => {
  const d = stubs()
  try {
    const s = run(d, ['status']); assert.equal(s.status, 0, s.stderr); assert.equal(s.stdout.trim(), 'files=3')
    assert.equal(run(d, ['redeploy']).status, 0)
    assert.equal(run(d, ['push-redeploy']).status, 0)
    assert.deepEqual(calls(d), ['status', 'redeploy', 'put', 'redeploy'])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('unknown command exits 64 without contacting the box', () => {
  const d = stubs()
  try {
    const r = run(d, ['bogus']); assert.equal(r.status, 64); assert.match(r.stderr, /usage/)
    assert.deepEqual(calls(d), [])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

for (const [label, body] of [
  ['invalid JSON', '{"secrets": [ {"secretKey": "A", "secretValue": "sk-leak'],
  ['zero secrets', '{"secrets":[]}'],
  ['no secrets key', '{"message":"forbidden"}'],
  ['secrets not an array', '{"secrets":"sk-leak"}'],
  ['non-string value', '{"secrets":[{"secretKey":"A","secretValue":null}]}'],
  ['name with a newline', '{"secrets":[{"secretKey":"A\\nB","secretValue":"sk-leak"}]}'],
  ['empty file', ''],
]) {
  test(`fetch failure (${label}) exits non-zero and never calls ssh`, () => {
    const d = stubs()
    try {
      writeFileSync(join(d, 'bundle.json'), body)
      for (const cmd of ['push', 'push-redeploy']) {
        const r = run(d, [cmd]); assert.notEqual(r.status, 0, cmd)
        assert.ok(!r.stdout.includes('sk-leak') && !r.stderr.includes('sk-leak'), 'value leaked to output')
      }
      assert.deepEqual(calls(d), [])
      const e = run(d, ['ensure'], { FAKE_STATUS: 'files=0' }); assert.notEqual(e.status, 0)
      assert.deepEqual(calls(d), ['status'], 'ensure must not put or redeploy after a failed fetch')
    } finally { rmSync(d, { recursive: true, force: true }) }
  })
}

test('missing bundle file exits non-zero and never calls ssh', () => {
  const d = stubs()
  try {
    const r = run(d, ['push'], { BOM_SECRETS_BUNDLE_JSON: join(d, 'nope.json') })
    assert.notEqual(r.status, 0); assert.deepEqual(calls(d), [])
  } finally { rmSync(d, { recursive: true, force: true }) }
})

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
  const d = stubs(Object.entries(values).map(([secretKey, secretValue]) => ({ secretKey, secretValue })))
  try {
    const r = run(d, ['push']); assert.equal(r.status, 0, r.stderr)
    const stream = readFileSync(join(d, 'stdin.put'))
    const root = join(d, 'box', 'bom-secrets')
    execFileSync('mkdir', ['-p', join(d, 'box')])
    const rcv = spawnSync('sh', [receiver], { input: stream, encoding: 'utf8', timeout: 30000,
      env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: 'put', BOM_SECRETS_ROOT: root, BOM_SECRETS_SKIP_TMPFS_CHECK: '1' } })
    assert.equal(rcv.status, 0, rcv.stderr)
    assert.equal(rcv.stdout.trim(), `stored=${Object.keys(values).length}`)
    assert.deepEqual(readdirSync(root).sort(), Object.keys(values).sort())
    for (const [k, v] of Object.entries(values)) {
      assert.ok(readFileSync(join(root, k)).equals(Buffer.from(v, 'utf8')), `${k} bytes differ`)
    }
  } finally { rmSync(d, { recursive: true, force: true }) }
})

// Fake curl for the real Infisical path: logs argv and stdin per call, answers login then secrets.
function infisicalStubs(loginOk = true) {
  const d = stubs()
  const id = join(d, 'infisical'); execFileSync('mkdir', [id])
  writeFileSync(join(id, '.client-id'), 'cid-123\n')
  writeFileSync(join(id, '.client-secret'), 'csec-leak\n')
  writeFileSync(join(id, '.prod-project-id'), 'proj-1\n')
  writeFileSync(join(d, 'curl'), `#!/bin/sh
n=$(ls "${d}" | grep -c '^curl-argv') ; n=$((n + 1))
printf '%s\\n' "$@" > "${d}/curl-argv.$n"; cat > "${d}/curl-stdin.$n"
case "$*" in
  *universal-auth/login*) ${loginOk ? `echo '{"accessToken":"tok-leak"}'` : 'echo "curl: (22) 401" >&2; exit 22'} ;;
  *secrets/raw*) cat "${d}/bundle.json" ;;
  *) exit 99 ;;
esac
`)
  chmodSync(join(d, 'curl'), 0o755)
  return [d, { BOM_SECRETS_BUNDLE_JSON: '', BOM_INFISICAL_DIR: id, BOM_INFISICAL_HOST: 'http://infisical.test' }]
}

test('real Infisical path: login then raw secrets, credentials and token only on stdin', () => {
  const [d, env] = infisicalStubs()
  try {
    const r = run(d, ['push'], env); assert.equal(r.status, 0, r.stderr)
    const argv1 = readFileSync(join(d, 'curl-argv.1'), 'utf8'), argv2 = readFileSync(join(d, 'curl-argv.2'), 'utf8')
    assert.match(argv1, /http:\/\/infisical\.test\/api\/v1\/auth\/universal-auth\/login/)
    assert.deepEqual(JSON.parse(readFileSync(join(d, 'curl-stdin.1'), 'utf8')), { clientId: 'cid-123', clientSecret: 'csec-leak' })
    assert.match(argv2, /http:\/\/infisical\.test\/api\/v3\/secrets\/raw/)
    for (const p of ['environment=prod', 'secretPath=/bom-runtime', 'workspaceId=proj-1']) assert.ok(argv2.includes(p), p)
    assert.equal(readFileSync(join(d, 'curl-stdin.2'), 'utf8'), 'header = "Authorization: Bearer tok-leak"\n')
    for (const a of [argv1, argv2, r.stdout, r.stderr]) assert.ok(!/csec-leak|tok-leak|sk-1/.test(a), 'credential in argv/output')
    assert.equal(readFileSync(join(d, 'stdin.put'), 'utf8').trim().split('\n').at(-1), '.END\t2')
  } finally { rmSync(d, { recursive: true, force: true }) }
})

test('real Infisical path: failed login exits non-zero and never calls ssh', () => {
  const [d, env] = infisicalStubs(false)
  try {
    const r = run(d, ['push'], env); assert.notEqual(r.status, 0)
    assert.ok(!existsSync(join(d, 'curl-argv.2')), 'no secrets request without a token')
    assert.deepEqual(calls(d), [])
  } finally { rmSync(d, { recursive: true, force: true }) }
})
