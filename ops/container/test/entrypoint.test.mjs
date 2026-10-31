import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const entry = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'entrypoint.sh')

function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'bom-secrets-'))
  for (const [k, v] of Object.entries(files)) writeFileSync(join(dir, k), v)
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
const run = (dir, extraEnv = {}, cmd = ['node', '-e', 'process.stdout.write(JSON.stringify(process.env))']) =>
  spawnSync('sh', [entry, ...cmd], { env: { PATH: process.env.PATH, BOM_SECRETS_DIR: dir, ...extraEnv }, encoding: 'utf8' })

test('parses as POSIX shell', () => { execFileSync('sh', ['-n', entry]) })

test('exports one variable per file, preserving spaces, $ and quotes', () => {
  withDir({ MYSQL_PASSWORD: 'p a$s"w\'d', OPENAI_BOT_API_KEY: 'sk-x\n\n' }, (dir) => {
    const r = run(dir); assert.equal(r.status, 0, r.stderr)
    const env = JSON.parse(r.stdout)
    assert.equal(env.MYSQL_PASSWORD, 'p a$s"w\'d')
    assert.equal(env.OPENAI_BOT_API_KEY, 'sk-x') // $(cat) strips ALL trailing newlines
  })
})

test('skips files whose names are not valid env names, naming them but not their values', () => {
  withDir({ 'bad-name': 'VALUE-SHOULD-NOT-APPEAR', '1LEADING': 'x', GOOD_NAME: 'ok' }, (dir) => {
    const r = run(dir); assert.equal(r.status, 0, r.stderr)
    const env = JSON.parse(r.stdout)
    assert.equal(env.GOOD_NAME, 'ok'); assert.equal(env['bad-name'], undefined); assert.equal(env['1LEADING'], undefined)
    assert.ok(r.stderr.includes("'bad-name'"), r.stderr)
    assert.ok(!r.stderr.includes('VALUE-SHOULD-NOT-APPEAR'))
  })
})

test('missing directory passes through when not required', () => {
  const r = run('/nonexistent-bom-secrets'); assert.equal(r.status, 0, r.stderr)
})

test('BOM_REQUIRE_SECRETS=1 refuses to start without MYSQL_PASSWORD, and never echoes values', () => {
  withDir({ OPENAI_BOT_API_KEY: 'sk-SHOULD-NOT-APPEAR' }, (dir) => {
    const r = run(dir, { BOM_REQUIRE_SECRETS: '1' }, ['true'])
    assert.equal(r.status, 78)
    assert.ok(!r.stderr.includes('sk-SHOULD-NOT-APPEAR'))
    assert.ok(!r.stdout.includes('sk-SHOULD-NOT-APPEAR'))
  })
})

test('BOM_REQUIRE_SECRETS=1 with MYSQL_PASSWORD present starts and exports it', () => {
  withDir({ MYSQL_PASSWORD: 'pw-present' }, (dir) => {
    const r = run(dir, { BOM_REQUIRE_SECRETS: '1' }); assert.equal(r.status, 0, r.stderr)
    assert.equal(JSON.parse(r.stdout).MYSQL_PASSWORD, 'pw-present')
  })
})

test('files cannot override BOM_* control variables', () => {
  withDir({ BOM_REQUIRE_SECRETS: '0', BOM_SECRETS_DIR: '/elsewhere' }, (dir) => {
    const r = run(dir, { BOM_REQUIRE_SECRETS: '1' }, ['true'])
    assert.equal(r.status, 78, r.stderr)
  })
})

test('unreadable file fails closed with 78 and does not leak its value', { skip: process.getuid?.() === 0 && 'root can read mode-000 files' }, () => {
  withDir({ MYSQL_PASSWORD: 'sk-UNREADABLE-VALUE' }, (dir) => {
    chmodSync(join(dir, 'MYSQL_PASSWORD'), 0o000)
    const r = run(dir, {}, ['true'])
    assert.equal(r.status, 78, r.stderr)
    assert.ok(r.stderr.includes('MYSQL_PASSWORD'), r.stderr)
    assert.ok(!r.stderr.includes('sk-UNREADABLE-VALUE') && !r.stdout.includes('sk-UNREADABLE-VALUE'))
  })
})
