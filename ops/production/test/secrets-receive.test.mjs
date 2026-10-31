import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'secrets-receive.sh')
const b64 = (s) => Buffer.from(s).toString('base64')
function call(cmd, input, root) {
  return spawnSync('sh', [script], {
    input, encoding: 'utf8',
    env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: cmd, BOM_SECRETS_ROOT: root, BOM_SECRETS_SKIP_TMPFS_CHECK: '1' },
  })
}
const fresh = () => { const p = mkdtempSync(join(tmpdir(), 'rcv-')); return [p, join(p, 'bom-secrets')] }

test('parses as POSIX shell', () => { execFileSync('sh', ['-n', script]) })

test('put stores one 0400 file per variable and reports a count, never values', () => {
  const [p, root] = fresh()
  try {
    const r = call('put', `MYSQL_PASSWORD\t${b64('s3cr3t value')}\nOPENAI_BOT_API_KEY\t${b64('sk-abc')}\n`, root)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout.trim(), 'stored=2')
    assert.ok(!r.stdout.includes('s3cr3t') && !r.stderr.includes('s3cr3t'))
    assert.equal(readFileSync(join(root, 'MYSQL_PASSWORD'), 'utf8'), 's3cr3t value')
    assert.equal(statSync(join(root, 'MYSQL_PASSWORD')).mode & 0o777, 0o400)
    assert.equal(statSync(root).mode & 0o777, 0o700)
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('put replaces the whole bundle atomically (removed keys disappear)', () => {
  const [p, root] = fresh()
  try {
    call('put', `A_KEY\t${b64('1')}\nB_KEY\t${b64('2')}\n`, root)
    const r = call('put', `A_KEY\t${b64('3')}\n`, root)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(readdirSync(root).sort(), ['A_KEY'])
    assert.equal(readdirSync(p).length, 1, 'no .new/.old leftovers')
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('put rejects invalid names and empty bundles without touching the live dir', () => {
  const [p, root] = fresh()
  try {
    call('put', `KEEP\t${b64('x')}\n`, root)
    assert.notEqual(call('put', `../etc/passwd\t${b64('x')}\n`, root).status, 0)
    assert.notEqual(call('put', '', root).status, 0)
    assert.deepEqual(readdirSync(root), ['KEEP'])
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('status reports file count only; unknown commands are refused', () => {
  const [p, root] = fresh()
  try {
    assert.equal(call('status', '', root).stdout.trim(), 'files=0')
    call('put', `K\t${b64('v')}\n`, root)
    assert.equal(call('status', '', root).stdout.trim(), 'files=1')
    assert.equal(call('bash -i', '', root).status, 64)
  } finally { rmSync(p, { recursive: true, force: true }) }
})
