import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'secrets-receive.sh')
const source = readFileSync(script, 'utf8')
const b64 = (s) => Buffer.from(s).toString('base64')
// bundle([[name, value], ...]) -> "NAME\tbase64\n"... + ".END\tN\n"
const bundle = (pairs) => pairs.map(([k, v]) => `${k}\t${b64(v)}\n`).join('') + `.END\t${pairs.length}\n`
function call(cmd, input, root, extraPath) {
  return spawnSync('sh', [script], {
    input, encoding: 'utf8', timeout: 30000,
    env: {
      PATH: extraPath ? `${extraPath}:${process.env.PATH}` : process.env.PATH,
      SSH_ORIGINAL_COMMAND: cmd, BOM_SECRETS_ROOT: root, BOM_SECRETS_SKIP_TMPFS_CHECK: '1',
    },
  })
}
const fresh = () => { const p = mkdtempSync(join(tmpdir(), 'rcv-')); return [p, join(p, 'bom-secrets')] }
// Seed a live bundle containing only KEEP, then run fn; always clean up.
function withLive(fn) {
  const [p, root] = fresh()
  try {
    assert.equal(call('put', bundle([['KEEP', 'x']]), root).status, 0)
    fn(p, root)
  } finally { rmSync(p, { recursive: true, force: true }) }
}
const assertUntouched = (p, root) => {
  assert.deepEqual(readdirSync(p), ['bom-secrets'], 'no .new/.old/lock leftovers')
  assert.deepEqual(readdirSync(root), ['KEEP'])
  assert.equal(readFileSync(join(root, 'KEEP'), 'utf8'), 'x')
}
function stub(name, body) {
  const d = mkdtempSync(join(tmpdir(), 'stub-'))
  writeFileSync(join(d, name), `#!/bin/sh\n${body}\n`); chmodSync(join(d, name), 0o755)
  return d
}

test('parses as POSIX shell', () => { execFileSync('sh', ['-n', script]) })

test('put stores one 0400 file per variable and reports a count, never values', () => {
  const [p, root] = fresh()
  try {
    const r = call('put', bundle([['MYSQL_PASSWORD', 's3cr3t value'], ['OPENAI_BOT_API_KEY', 'sk-abc']]), root)
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
    call('put', bundle([['A_KEY', '1'], ['B_KEY', '2']]), root)
    const r = call('put', bundle([['A_KEY', '3']]), root)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(readdirSync(root).sort(), ['A_KEY'])
    assert.equal(readdirSync(p).length, 1, 'no .new/.old/lock leftovers')
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('an empty value after the TAB is allowed', () => {
  const [p, root] = fresh()
  try {
    const r = call('put', 'EMPTY_OK\t\n.END\t1\n', root)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(join(root, 'EMPTY_OK'), 'utf8'), '')
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('put rejects invalid names and empty bundles without touching the live dir', () => withLive((p, root) => {
  assert.notEqual(call('put', `../etc/passwd\t${b64('x')}\n.END\t1\n`, root).status, 0)
  assert.notEqual(call('put', '', root).status, 0)
  assert.notEqual(call('put', '.END\t0\n', root).status, 0)
  assertUntouched(p, root)
}))

test('truncated streams are refused: missing trailer, wrong count, data after trailer', () => withLive((p, root) => {
  assert.notEqual(call('put', `A_KEY\t${b64('1')}\n`, root).status, 0, 'missing trailer')
  assert.notEqual(call('put', `A_KEY\t${b64('1')}\n.END\t1`, root).status, 0, 'trailer without newline')
  assert.notEqual(call('put', `A_KEY\t${b64('1')}\nB_KEY\t${b64('2')}\n.END\t3\n`, root).status, 0, 'wrong count')
  assert.notEqual(call('put', `A_KEY\t${b64('1')}\n.END\tx\n`, root).status, 0, 'non-numeric count')
  assert.notEqual(call('put', `A_KEY\t${b64('1')}\n.END\t1\nB_KEY\t${b64('2')}\n`, root).status, 0, 'after trailer')
  assertUntouched(p, root)
}))

test('malformed lines, duplicates and reserved names are refused', () => withLive((p, root) => {
  assert.notEqual(call('put', `NO_TAB_HERE\n.END\t1\n`, root).status, 0, 'no tab')
  assert.notEqual(call('put', `\n.END\t0\n`, root).status, 0, 'blank line')
  assert.notEqual(call('put', bundle([['DUP', '1'], ['DUP', '2']]), root).status, 0, 'duplicate')
  for (const name of ['BOM_SECRETS_ROOT', 'BOM_X', 'PATH', 'NODE_OPTIONS', 'LD_PRELOAD', 'LD_LIBRARY_PATH']) {
    assert.notEqual(call('put', bundle([[name, 'v']]), root).status, 0, name)
  }
  assertUntouched(p, root)
}))

test('caps: value over 65536 base64 chars or more than 256 variables is refused', () => withLive((p, root) => {
  assert.notEqual(call('put', `BIG\t${'A'.repeat(65540)}\n.END\t1\n`, root).status, 0, 'big value')
  const many = Array.from({ length: 257 }, (_, i) => [`K${i}`, 'v'])
  assert.notEqual(call('put', bundle(many), root).status, 0, '257 vars')
  assertUntouched(p, root)
  const ok = call('put', bundle(many.slice(0, 256)), root)
  assert.equal(ok.status, 0, ok.stderr)
  assert.equal(ok.stdout.trim(), 'stored=256')
}))

test('unexpected failure mid-write leaves no leftovers and the live dir intact', () => withLive((p, root) => {
  const d = stub('chmod', 'exit 1')
  try {
    assert.notEqual(call('put', bundle([['A_KEY', '1']]), root, d).status, 0)
    assertUntouched(p, root)
  } finally { rmSync(d, { recursive: true, force: true }) }
}))

test('failure while swapping restores the previous live dir', () => withLive((p, root) => {
  // mv of the new dir into place fails after the live dir was moved aside
  const d = stub('mv', 'case "$1" in *.new.*) exit 1 ;; esac\nexec /bin/mv "$@"')
  try {
    assert.notEqual(call('put', bundle([['A_KEY', '1']]), root, d).status, 0)
    assertUntouched(p, root)
  } finally { rmSync(d, { recursive: true, force: true }) }
}))

test('stale .new/.old dirs from a crashed run are swept under the lock', () => {
  const [p, root] = fresh()
  try {
    mkdirSync(`${root}.new.99999`); mkdirSync(`${root}.old.99998`)
    const r = call('put', bundle([['A_KEY', '1']]), root)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(readdirSync(p), ['bom-secrets'])
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('a held lock makes put refuse without touching the live dir or the lock', () => withLive((p, root) => {
  const lock = join(p, 'bom-secrets.lock.d')
  mkdirSync(lock)
  const r = call('put', bundle([['A_KEY', '1']]), root)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /busy/)
  assert.ok(statSync(lock).isDirectory(), 'lock held by another run is not released')
  rmSync(lock, { recursive: true })
  assertUntouched(p, root)
}))

test('status reports file count only; unknown commands are refused', () => {
  const [p, root] = fresh()
  try {
    assert.equal(call('status', '', root).stdout.trim(), 'files=0')
    call('put', bundle([['K', 'v']]), root)
    assert.equal(call('status', '', root).stdout.trim(), 'files=1')
    assert.equal(call('bash -i', '', root).status, 64)
  } finally { rmSync(p, { recursive: true, force: true }) }
})

test('root ignores test overrides; redeploy runs detached from the SSH session with the normal umask', () => {
  assert.match(source, /if \[ "\$\(id -u\)" = 0 \]; then\n\s*ROOT=\/run\/bom-secrets; SKIP_TMPFS_CHECK=0/)
  assert.match(source, /redeploy\)\n(\s*#.*\n)*\s*exec systemd-run --wait --collect --quiet --unit=bom-redeploy --property=UMask=0022 \/home\/ubuntu\/greenfield\/deploy-blue-green\.sh --redeploy-active ;;/)
})

test('redeploy hands the deploy to a fixed-name transient unit and passes its exit status back', () => {
  for (const rc of [0, 3]) {
    const d = stub('systemd-run', `printf '%s\\n' "$@" > "$(dirname "$0")/argv"; exit ${rc}`)
    try {
      const r = call('redeploy', '', join(d, 'bom-secrets'), d)
      assert.equal(r.status, rc)
      assert.deepEqual(readFileSync(join(d, 'argv'), 'utf8').trim().split('\n'), ['--wait', '--collect', '--quiet',
        '--unit=bom-redeploy', '--property=UMask=0022', '/home/ubuntu/greenfield/deploy-blue-green.sh', '--redeploy-active'])
    } finally { rmSync(d, { recursive: true, force: true }) }
  }
})
