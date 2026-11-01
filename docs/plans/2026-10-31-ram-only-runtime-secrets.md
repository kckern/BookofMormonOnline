# RAM-only Runtime Secrets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The production EC2 box holds no secret store (no AWS Secrets Manager reads, no `.env` files on disk); the app's runtime config lives only in a RAM-backed directory pushed one-way from homeserver, and GitHub-driven image upgrades keep working without re-delivering secrets.

**Architecture:** Homeserver's `bom` user reads Infisical (`prod`, folder `/bom-runtime`) and streams a bundle over SSH to a forced-command receiver on the box, which writes one file per variable into `/run/bom-secrets` (tmpfs, root 0700). The blue/green deploy bind-mounts that directory read-only at `/run/secrets`; a tiny container entrypoint loads the files into the environment and `exec`s pm2. `docker inspect` shows only the mount path, never values. A homeserver timer re-pushes after an EC2 reboot (tmpfs is wiped), still connecting outward only.

**Tech Stack:** POSIX sh (Ubuntu dash on host, BusyBox ash in `node:*-alpine`), bash on homeserver, `node:test` for tests, Infisical REST API (universal auth), OpenSSH forced commands, systemd user timers, Docker.

**Context the engineer needs (incident 2026-10-31):**
- Repo: `kckern/BookofMormonOnline` (PUBLIC). Working copy on homeserver at `/home/bom/BookofMormonOnline`, owned by user `bom`. Deploys run from branch `prod`.
- CI: `.github/workflows/deploy-prod.yml` builds, cosign-signs, pushes `kckern/bookofmormon-online@sha256:…` to Docker Hub, then OIDC → SSM document `bom-deploy`, which writes `ops/production/deploy-blue-green.sh` to `/home/ubuntu/greenfield/` on the box and runs it as root with `BOM_IMAGE=<digest>`.
- Today the deploy script calls `aws secretsmanager get-secret-value` for `bom/prod/{db,openai,app,mail}` (instance role `bomdocker-role`, inline policy `BomSecretsRead`) and writes `/home/ubuntu/greenfield/.env` + `mail.env`, then `docker run --env-file …`. That is what this plan removes.
- Box: `i-02c9619a48343a8d9`, Elastic IP `52.42.0.250`, Ubuntu 24.04, `/run` is tmpfs (769 MB). SSH (22) is allowed only from home IP `73.109.47.154`. Admin access from a Mac uses EC2 Instance Connect (`aws ec2-instance-connect send-ssh-public-key …`, then `ssh ubuntu@52.42.0.250`).
- Homeserver: `homeserver.local`, Infisical at `http://127.0.0.1:8070` (public name `secrets.kckern.net`, Cloudflare-blocked outside home). User `bom` has Infisical machine identity files in `/home/bom/infisical/{.client-id,.client-secret,.prod-project-id}`. BoMOnline project id: the contents of `/home/bom/infisical/.prod-project-id` (also Infisical UI → BoMOnline → Project settings); the steps below read it from `$BOM_INFISICAL_PROJECT`, never a literal.
- Never print secret values in logs, test output, or commit messages. Compare by `sha256sum | cut -c1-8` when you must check equality.

**Out of scope (separate plan):** scripture-guide, php/BoMDocker, sendy, cloudflared compose apps (third-party images; need per-image `*_FILE` support); IMDS hop limit (the app still uses instance-role credentials for SES/SQS/S3/CloudFront; those are short-lived, not stored).

---

### Task 0: Defuse the stale deploy timer (do first, on the box)

`bom-deploy.timer` runs `deploy-blue-green.sh` every ~5 min as `ubuntu` with no `BOM_IMAGE`, so it falls back to `/home/ubuntu/greenfield/desired-image`, which pins an OLDER digest (`sha256:0fca…`) than the running patched one (`sha256:e646…`). It only fails today because `active-slot` became root-only. If anyone fixes the permission, it rolls production back.

**Step 1: Pin the running digest and disable the timer**

```bash
# on the box (EC2 Instance Connect as ubuntu)
A=$(sudo cat /home/ubuntu/greenfield/active-slot)
IMG=$(sudo docker inspect "$A" --format '{{.Config.Image}}')
case "$IMG" in kckern/bookofmormon-online@sha256:*) printf '%s\n' "$IMG" | sudo tee /home/ubuntu/greenfield/desired-image >/dev/null;; *) echo "STOP: unexpected $IMG";; esac
sudo systemctl disable --now bom-deploy.timer
sudo systemctl reset-failed bom-deploy.service
```

**Step 2: Verify**

Run: `systemctl is-enabled bom-deploy.timer; systemctl is-active bom-deploy.timer; cat /home/ubuntu/greenfield/desired-image`
Expected: `disabled`, `inactive`, and the same digest as `docker inspect "$A" --format '{{.Config.Image}}'`.

**Step 3: Record in repo** — in `ops/production/README.md`, under the deployment section, add one line: "`bom-deploy.timer` is retired (2026-10-31): deploys are CI → SSM only; the timer redeployed a stale `desired-image` pin." Commit with Task 4.

---

### Task 1: Container entrypoint that loads `/run/secrets/*`

**Files:**
- Create: `ops/container/entrypoint.sh`
- Create: `ops/container/test/entrypoint.test.mjs`
- Modify: `Dockerfile` (runtime stage, after `COPY ops/container ./ops/container`, line ~47)

**Step 1: Write the failing test**

```js
// ops/container/test/entrypoint.test.mjs
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
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
  withDir({ MYSQL_PASSWORD: 'p a$s"w\'d', OPENAI_BOT_API_KEY: 'sk-x\n' }, (dir) => {
    const r = run(dir); assert.equal(r.status, 0, r.stderr)
    const env = JSON.parse(r.stdout)
    assert.equal(env.MYSQL_PASSWORD, 'p a$s"w\'d')
    assert.equal(env.OPENAI_BOT_API_KEY, 'sk-x') // single trailing newline trimmed
  })
})

test('skips files whose names are not valid env names', () => {
  withDir({ 'bad-name': 'x', '1LEADING': 'x', GOOD_NAME: 'ok' }, (dir) => {
    const env = JSON.parse(run(dir).stdout)
    assert.equal(env.GOOD_NAME, 'ok'); assert.equal(env['bad-name'], undefined); assert.equal(env['1LEADING'], undefined)
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
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --test ops/container/test/entrypoint.test.mjs`
Expected: FAIL (`sh: can't open … entrypoint.sh` / ENOENT).

**Step 3: Write minimal implementation**

```sh
#!/bin/sh
# Container entrypoint: load runtime config from RAM-backed files, then exec the command.
# One file per variable: file name = variable name, content = value. Values are never printed.
# Mounted by ops/production/deploy-blue-green.sh from the host's /run/bom-secrets (tmpfs).
# Also usable for one-off jobs: docker exec <ctr> /app/ops/container/entrypoint.sh node script.mjs
set -eu
dir="${BOM_SECRETS_DIR:-/run/secrets}"
if [ -d "$dir" ]; then
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    name="${f##*/}"
    case "$name" in
      ''|[0-9]*|*[!A-Za-z0-9_]*) echo "entrypoint: skipping invalid variable name in $dir" >&2; continue ;;
    esac
    value="$(cat "$f")"
    export "$name=$value"
  done
fi
if [ "${BOM_REQUIRE_SECRETS:-0}" = 1 ] && [ -z "${MYSQL_PASSWORD:-}" ]; then
  echo "entrypoint: runtime config missing in $dir (MYSQL_PASSWORD unset); refusing to start" >&2
  exit 78
fi
exec "$@"
```

Note: `$(cat …)` strips ALL trailing newlines; the test asserts a single trailing newline is trimmed, which is the intended behavior for values pasted with a newline.

**Step 4: Run tests to verify they pass**

Run: `chmod 0755 ops/container/entrypoint.sh && node --test ops/container/test/entrypoint.test.mjs`
Expected: 5 passing.

**Step 5: Wire into the image**

In `Dockerfile` runtime stage, directly after `COPY ops/container ./ops/container` add:

```dockerfile
RUN chmod 0755 /app/ops/container/entrypoint.sh
ENTRYPOINT ["/app/ops/container/entrypoint.sh"]
```

Leave `CMD ["pm2-runtime", "ecosystem.config.cjs"]` unchanged. The deploy uses `docker run --init`, so the process tree is tini → entrypoint (exec) → pm2-runtime; pm2 children inherit the loaded environment.

**Step 6: Smoke-test the built image locally (homeserver)**

```bash
docker build -t bom-entry-test .
d=$(mktemp -d); printf 'x' > "$d/MYSQL_PASSWORD"
docker run --rm -v "$d:/run/secrets:ro" bom-entry-test node -e 'console.log(process.env.MYSQL_PASSWORD===`x`)'
rm -rf "$d"
```
Expected: `true`.

Also check `ops/container/healthcheck.mjs` does not read any secret (it runs via Docker HEALTHCHECK, which bypasses ENTRYPOINT). Run: `grep -n "process.env" ops/container/healthcheck.mjs` — Expected: no secret names. If it needs one, prefix its HEALTHCHECK CMD with the entrypoint.

**Step 7: Commit**

```bash
git add ops/container/entrypoint.sh ops/container/test/entrypoint.test.mjs Dockerfile
git commit -m "feat(ops): container entrypoint loads runtime config from /run/secrets files"
```

---

### Task 2: One-off jobs load secrets the same way

`docker exec` does not run ENTRYPOINT, so ingest jobs must call it explicitly.

**Files:**
- Modify: `.github/workflows/ingest-korean-bot-avatars.yml` (the `docker exec -w /app/backend "$ACTIVE" node …` line)
- Modify: `.github/workflows/ingest-french-bot-avatars.yml` (same pattern)
- Modify: `.github/workflows/ingest-group-covers.yml` (`docker exec "$ACTIVE" node /app/backend/scripts/ingest-group-covers.mjs`)
- Test: `ops/production/test/deployment.test.mjs`

**Step 1: Write the failing test** (append to `deployment.test.mjs`)

```js
test('one-off docker exec jobs load runtime config through the entrypoint', () => {
  for (const wf of ['ingest-korean-bot-avatars.yml', 'ingest-french-bot-avatars.yml', 'ingest-group-covers.yml']) {
    const src = readFileSync(resolve(root, '..', '..', '.github', 'workflows', wf), 'utf8')
    for (const line of src.split('\n').filter((l) => /docker exec .*\bnode\b/.test(l))) {
      assert.match(line, /\/app\/ops\/container\/entrypoint\.sh node/, `${wf}: ${line.trim()}`)
    }
  }
})
```

**Step 2: Run to verify it fails**

Run: `node --test ops/production/test/deployment.test.mjs`
Expected: FAIL on the new test.

**Step 3: Implement** — in each workflow, change `… "$ACTIVE" node …` to `… "$ACTIVE" /app/ops/container/entrypoint.sh node …` (keep `-w /app/backend` where present). The `mkdir -p` exec line needs no change.

**Step 4: Run to verify it passes** — same command; Expected: all pass.

**Step 5: Commit**

```bash
git add .github/workflows/ingest-*.yml ops/production/test/deployment.test.mjs
git commit -m "fix(ops): ingest jobs load runtime config via container entrypoint"
```

---

### Task 3: Box-side receiver (forced-command endpoint)

**Files:**
- Create: `ops/production/secrets-receive.sh`
- Create: `ops/production/test/secrets-receive.test.mjs`

**Step 1: Write the failing test**

```js
// ops/production/test/secrets-receive.test.mjs
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
  assert.match(source, /redeploy\)\n(\s*#.*\n)*\s*exec systemd-run --wait --collect --quiet --unit=bom-redeploy --property=UMask=0022 --setenv=HOME=\/root \/home\/ubuntu\/greenfield\/deploy-blue-green\.sh --redeploy-active ;;/)
})

test('redeploy hands the deploy to a fixed-name transient unit and passes its exit status back', () => {
  for (const rc of [0, 3]) {
    const d = stub('systemd-run', `printf '%s\\n' "$@" > "$(dirname "$0")/argv"; exit ${rc}`)
    try {
      const r = call('redeploy', '', join(d, 'bom-secrets'), d)
      assert.equal(r.status, rc)
      assert.deepEqual(readFileSync(join(d, 'argv'), 'utf8').trim().split('\n'), ['--wait', '--collect', '--quiet',
        '--unit=bom-redeploy', '--property=UMask=0022', '--setenv=HOME=/root', '/home/ubuntu/greenfield/deploy-blue-green.sh', '--redeploy-active'])
    } finally { rmSync(d, { recursive: true, force: true }) }
  }
})
```

**Step 2: Run to verify it fails**

Run: `node --test ops/production/test/secrets-receive.test.mjs`
Expected: FAIL (script missing).

**Step 3: Write minimal implementation**

```sh
#!/bin/sh
# Forced-command endpoint for homeserver's push key (installed as /usr/local/sbin/bom-secrets-receive).
# Commands (via SSH_ORIGINAL_COMMAND): status | put | redeploy. Never prints values.
# put reads lines "NAME<TAB>base64(value)" on stdin, then a trailer ".END<TAB>N" (N = number of
# variable lines), and atomically replaces the bundle dir. Anything short of that is refused.
set -eu
if [ "$(id -u)" = 0 ]; then
  ROOT=/run/bom-secrets; SKIP_TMPFS_CHECK=0          # test overrides never apply in production
else
  ROOT="${BOM_SECRETS_ROOT:-/run/bom-secrets}"; SKIP_TMPFS_CHECK="${BOM_SECRETS_SKIP_TMPFS_CHECK:-0}"
fi
PARENT="$(dirname "$ROOT")"
LOCK="$PARENT/bom-secrets.lock.d"
TAB="$(printf '\t')"
MAX_VARS=256
MAX_B64=65536
umask 077

refuse() { echo "refusing: $1" >&2; exit 1; }

new=""; old=""; locked=0
cleanup() {
  set +e                                             # best effort: always reach the lock release
  [ -z "$new" ] || rm -rf "$new"
  if [ -n "$old" ] && [ -d "$old" ] && [ ! -e "$ROOT" ]; then mv "$old" "$ROOT"; fi
  [ -z "$old" ] || [ ! -e "$ROOT" ] || rm -rf "$old"
  [ "$locked" != 1 ] || rmdir "$LOCK"
}

case "${SSH_ORIGINAL_COMMAND:-}" in
  status)
    n=0; [ -d "$ROOT" ] && n=$(find "$ROOT" -maxdepth 1 -type f | wc -l)
    echo "files=$((n + 0))" ;;
  put)
    if [ "$SKIP_TMPFS_CHECK" != 1 ] && [ "$(findmnt -no FSTYPE --target "$PARENT")" != tmpfs ]; then
      refuse "$PARENT is not tmpfs"
    fi
    trap cleanup EXIT
    trap 'exit 1' HUP INT TERM
    tries=0
    until mkdir "$LOCK" 2>/dev/null; do
      tries=$((tries + 1)); [ "$tries" -lt 10 ] || refuse "busy: $LOCK held (stale after SIGKILL? rmdir it)"
      sleep 1
    done
    locked=1
    rm -rf "$ROOT".new.* "$ROOT".old.*                  # leftovers from a run that was killed
    new="$ROOT.new.$$"; mkdir -m 700 "$new"
    count=0; ended=0; expect=""
    while IFS= read -r line; do
      [ "$ended" = 0 ] || refuse "data after trailer"
      case "$line" in *"$TAB"*) ;; *) refuse "malformed line" ;; esac
      name="${line%%"$TAB"*}"; b64="${line#*"$TAB"}"
      if [ "$name" = .END ]; then
        case "$b64" in ''|*[!0-9]*) refuse "malformed trailer" ;; esac
        expect="$b64"; ended=1; continue
      fi
      case "$name" in
        ''|[0-9]*|*[!A-Za-z0-9_]*) refuse "invalid variable name" ;;
        BOM_*|PATH|NODE_OPTIONS|LD_*) refuse "reserved variable name" ;;
      esac
      [ "$count" -lt "$MAX_VARS" ] || refuse "more than $MAX_VARS variables"
      [ "${#b64}" -le "$MAX_B64" ] || refuse "value too large"
      [ ! -e "$new/$name" ] || refuse "duplicate variable name"
      printf '%s' "$b64" | base64 -d > "$new/$name" 2>/dev/null || refuse "bad encoding"
      chmod 400 "$new/$name"; count=$((count + 1))
    done
    [ "$ended" = 1 ] || refuse "missing trailer (truncated stream?)"
    [ "$expect" -eq "$count" ] || refuse "trailer count mismatch"
    [ "$count" -gt 0 ] || refuse "empty bundle"
    old="$ROOT.old.$$"
    if [ -d "$ROOT" ]; then mv "$ROOT" "$old"; fi
    [ ! -e "$ROOT" ] || refuse "$ROOT is in the way"
    mv "$new" "$ROOT"; new=""
    rm -rf "$old"; old=""
    echo "stored=$count" ;;
  redeploy)
    # Own transient unit: a dropped SSH session (homeserver timeout) cannot kill a deploy mid-way,
    # and the fixed name refuses a second concurrent redeploy. Output goes to the journal.
    # HOME=/root matches the old sudo environment (aws/cosign look there).
    exec systemd-run --wait --collect --quiet --unit=bom-redeploy --property=UMask=0022 --setenv=HOME=/root /home/ubuntu/greenfield/deploy-blue-green.sh --redeploy-active ;;
  *)
    echo "usage: status | put | redeploy" >&2; exit 64 ;;
esac
```

Running containers keep the values they loaded at start; a replaced bundle takes effect on the next deploy/redeploy.

Every new container start reads the latest bundle, including a crash-restart under `--restart always`: Docker re-resolves the bind-mount source path on each start, so it mounts the current `/run/bom-secrets`, not the directory that `put` renamed away.

Why the extra checks: the `.END<TAB>N` trailer means a cut-off SSH stream can never replace a good bundle with a partial one. The `mkdir` lock serializes concurrent pushes (and works on macOS for tests, unlike `flock`). The EXIT trap removes the staging dir and restores the old bundle if the swap fails, and the lock dir is released only by the run that took it. `BOM_*`, `PATH`, `NODE_OPTIONS` and `LD_*` are refused because some of them would allow code execution in the container. The caps are 256 variables and 65536 base64 chars per value. As root, the test overrides `BOM_SECRETS_ROOT` and `BOM_SECRETS_SKIP_TMPFS_CHECK` are ignored. `redeploy` keeps root (SSM deploys run as root and the state files are root-owned) and runs the deploy as its own transient systemd unit (`systemd-run --wait --collect --unit=bom-redeploy`, `UMask=0022`, `HOME=/root` as under the old sudo path). If homeserver's ssh times out or drops, the deploy keeps going; the fixed unit name makes a second concurrent redeploy fail instead of racing. Its output goes to the journal (`journalctl -u bom-redeploy`), not back over ssh; only the exit status returns. A run killed with SIGKILL can leave `bom-secrets.lock.d` behind; it is cleared by a reboot (tmpfs) or `sudo rmdir /run/bom-secrets.lock.d`.

**Step 4: Run to verify it passes** — same command; Expected: 15 passing (the held-lock test waits ~10 s). Also run them with dash as `sh` (put a dir with an `sh -> /bin/dash` symlink first on PATH). Also run on Ubuntu dash if your dev shell differs: `docker run --rm -v "$PWD:/w" -w /w ubuntu:24.04 sh -n ops/production/secrets-receive.sh`.

**Step 5: Commit**

```bash
git add -f ops/production/secrets-receive.sh   # .gitignore has a blanket *.sh rule
git add ops/production/test/secrets-receive.test.mjs
git commit -m "feat(ops): forced-command receiver writes runtime config to tmpfs"
```

---

### Task 4: Deploy script mounts RAM config instead of reading Secrets Manager

**Files:**
- Modify: `ops/production/deploy-blue-green.sh` (lines ~10-11 `ENV_FILE`/`MAIL_ENV_FILE`; ~196-248 `render_env_from_secrets` and its call/checks; ~300-310 the "already runs the desired healthy image" early exit; ~324-336 `docker run`)
- Test: `ops/production/test/deployment.test.mjs`

**Step 1: Write the failing tests** (append)

```js
test('deployment never reads a secret store or writes env files', () => {
  assert.ok(!deployment.includes('secretsmanager'), 'no Secrets Manager calls')
  assert.ok(!deployment.includes('--env-file'), 'no env files')
  assert.ok(!/>\s*"\$ENV_FILE"/.test(deployment), 'no rendered .env')
})

test('candidate mounts the tmpfs bundle read-only and requires it', () => {
  assert.match(deployment, /--mount type=bind,src=\/run\/bom-secrets,dst=\/run\/secrets,readonly/)
  assert.match(deployment, /BOM_REQUIRE_SECRETS=1/)
})

test('missing RAM bundle fails before the active slot is touched', () => {
  ordered(deployment, 'require_runtime_bundle', 'docker run -d')
})

test('--redeploy-active redeploys the running image even when healthy', () => {
  assert.match(deployment, /--redeploy-active/)
  ordered(deployment, 'REDEPLOY_ACTIVE', 'already runs the desired healthy image')
})
```

**Step 2: Run to verify they fail**

Run: `node --test ops/production/test/deployment.test.mjs`
Expected: 4 new FAILs.

**Step 3: Implement**

a) Delete `ENV_FILE=`/`MAIL_ENV_FILE=` (lines ~10-11), the whole `render_env_from_secrets()` function and its comment block, the call `render_env_from_secrets`, and the two `[ -r "$ENV_FILE" ]`/`[ -r "$MAIL_ENV_FILE" ]` checks.

b) Near the top, after `IMAGE=` handling, add:

```sh
REDEPLOY_ACTIVE=0
[ "${1:-}" = "--redeploy-active" ] && REDEPLOY_ACTIVE=1
SECRETS_DIR="${BOM_SECRETS_DIR:-/run/bom-secrets}"

# Runtime config lives only in RAM, pushed from homeserver (scripts/bom-secrets-push.sh).
# After an EC2 reboot it is empty until homeserver re-pushes; refuse rather than start a broken slot.
require_runtime_bundle() {
  [ -s "$SECRETS_DIR/MYSQL_PASSWORD" ] \
    || fail "runtime config not present in $SECRETS_DIR; run scripts/bom-secrets-push.sh push on homeserver"
}
```

c) When `REDEPLOY_ACTIVE=1`, set `IMAGE` to the active container's image before the pull. Place right after `active` is known:

```sh
if [ "$REDEPLOY_ACTIVE" = 1 ] && [ -n "$active" ]; then
  IMAGE="$(docker container inspect -f '{{.Config.Image}}' "$active")"
fi
```

d) Change the early exit condition (currently `if [ "$active_image" = "$desired_image" ] && [ "$active_health" = "healthy" ]; then`) to:

```sh
  if [ "$REDEPLOY_ACTIVE" = 0 ] && [ "$active_image" = "$desired_image" ] && [ "$active_health" = "healthy" ]; then
```

e) Call `require_runtime_bundle` immediately before `docker run -d`, and replace the two `--env-file` lines with:

```sh
  --mount type=bind,src=/run/bom-secrets,dst=/run/secrets,readonly \
  -e BOM_REQUIRE_SECRETS=1 \
  -e SANDBOX=0 -e NODE_ENV=production -e BOT_SCHEDULER_ENABLED=true -e LOG_LEVEL=info \
  -e PORT=5005 -e APP_BASE_URL=https://bookofmormon.online -e AWS_REGION=us-west-2 \
  -e "SOCKET_CORS_ORIGIN=$SOCKET_CORS_ORIGIN" \
```

and define `SOCKET_CORS_ORIGIN` as a shell variable near the top, copying the exact comma-separated value (and its KEEP IN SYNC comment) from the deleted `printf` block. These are non-secret flags and may appear in `docker inspect`.

**Step 4: Run all ops tests**

Run: `node --test ops/production/test/ ops/container/test/`
Expected: all pass (including the pre-existing ordering tests).

**Step 5: Commit** (with Task 0's README line)

```bash
git add ops/production/deploy-blue-green.sh ops/production/test/deployment.test.mjs ops/production/README.md
git commit -m "feat(ops): deploy mounts tmpfs runtime config; drop Secrets Manager and .env"
```

Do NOT push to `prod` yet; Task 8 sequences the cutover.

---

### Task 5: Homeserver push script

**Files:**
- Create: `scripts/bom-secrets-push.sh`
- Create: `scripts/test/bom-secrets-push.test.mjs`

**Step 1: Write the failing test** (stub `ssh` and `curl` on PATH; no network; never run the script without the stubs, since unstubbed it talks to production. Covers bundle encoding with the trailer, command routing, fetch failures sending nothing, credentials staying out of argv, and a byte-exact round trip through the real receiver)

```js
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
```

**Step 2: Run to verify it fails**

Run: `node --test scripts/test/bom-secrets-push.test.mjs`
Expected: FAIL (script missing).

**Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
# Push BoM runtime config (Infisical prod, folder /bom-runtime) into the EC2 box's RAM.
# Runs as user `bom` on homeserver. One-way: homeserver connects out; the box holds no way back.
# Usage: bom-secrets-push.sh push | status | redeploy | push-redeploy | ensure
#   push           replace the box's RAM bundle (running containers keep the old one)
#   status         print files=N (N = variables the box holds; 0 after a reboot)
#   redeploy       restart the active slot so it picks up the current bundle
#   push-redeploy  push, then redeploy (use this to rotate)
#   ensure         if the box reports files=0, push + redeploy (reboot recovery timer); also
#                  retries a redeploy that failed after an earlier ensure push
# Rotate with push-redeploy; a plain push leaves running containers on the previous bundle and
# breaks docker exec one-off jobs until a redeploy.
# Values are never printed, written to disk, or put in argv.
set -euo pipefail
set +x; unset BASH_XTRACEFD   # never debug with -x: the trace would print values and the token
shopt -s inherit_errexit 2>/dev/null || true   # bash >= 4.4; every step is also checked explicitly
HOST="${BOM_SECRETS_HOST:-bomsecrets@52.42.0.250}"
KEY="${BOM_SECRETS_KEY:-$HOME/.ssh/bom_secrets_ed25519}"
KNOWN_HOSTS="${BOM_SECRETS_KNOWN_HOSTS:-$HOME/.ssh/bom_secrets_known_hosts}"   # line: bom-prod <key>
# On disk, not XDG_RUNTIME_DIR (tmpfs): a pending redeploy must survive a homeserver reboot.
STATE_DIR="${BOM_SECRETS_STATE_DIR:-$HOME/.cache}"
PENDING="$STATE_DIR/bom-secrets-redeploy-pending"

usage() { echo "usage: $0 push|status|redeploy|push-redeploy|ensure (rotate with push-redeploy)" >&2; }

# Host key pinned under alias bom-prod; ~/.ssh/config ignored. Only put reads stdin. The timeout
# bounds a hung session (the box runs redeploy in its own unit, so cutting ssh does not kill it).
remote() {
  local t=() n=(-n)
  if command -v timeout >/dev/null 2>&1; then t=(timeout 1800); fi
  [ "$1" != put ] || n=()
  ${t[@]+"${t[@]}"} ssh -F none ${n[@]+"${n[@]}"} -T -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes \
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -o HostKeyAlias=bom-prod \
    -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 "$HOST" "$1"
}

# Self-contained (Task 6 sources this function alone). Prints the raw API JSON on stdout.
fetch_json() {
  # Test hook: a canned API response, honored only under BOM_SECRETS_TEST=1.
  if [ "${BOM_SECRETS_TEST:-}" = 1 ] && [ -n "${BOM_SECRETS_BUNDLE_JSON:-}" ]; then
    cat -- "$BOM_SECRETS_BUNDLE_JSON"; return
  fi
  local id_dir="${BOM_INFISICAL_DIR:-$HOME/infisical}" host="${BOM_INFISICAL_HOST:-http://127.0.0.1:8070}"
  local path="${BOM_SECRETS_PATH:-/bom-runtime}" token project tok_re='^[A-Za-z0-9._~+/=-]+$'
  project="$(tr -d '[:space:]' < "$id_dir/.prod-project-id")" || return 1
  # Client id/secret go to jq via --rawfile and to curl via stdin; the token via curl -K - (stdin).
  token="$(jq -nc --rawfile id "$id_dir/.client-id" --rawfile sec "$id_dir/.client-secret" \
      '{clientId:($id|rtrimstr("\n")),clientSecret:($sec|rtrimstr("\n"))}' \
    | curl -q -fsS -m 20 -X POST -H 'Content-Type: application/json' --data-binary @- \
        "$host/api/v1/auth/universal-auth/login" \
    | jq -er '.accessToken | strings' 2>/dev/null)" || { echo "infisical login failed" >&2; return 1; }
  [[ $token =~ $tok_re ]] || { echo "infisical login returned no usable token" >&2; return 1; }
  printf 'header = "Authorization: Bearer %s"\n' "$token" \
    | curl -q -fsS -m 20 -K - --get --data-urlencode "environment=prod" \
        --data-urlencode "secretPath=$path" --data-urlencode "workspaceId=$project" \
        --data-urlencode "expandSecretReferences=true" \
        "$host/api/v3/secrets/raw"
}

# Mirrors the receiver's rules so a bad Infisical entry fails here with a clear message. Prints
# one fixed reason (never a value), or "ok".
CHECK='
  def name_ok: test("^[A-Za-z_][A-Za-z0-9_]*\\z");
  def reserved: test("^(BOM_.*|PATH|NODE_OPTIONS|LD_.*)\\z");
  if type != "object" or (.secrets | type) != "array" then "response has no secrets list"
  elif (.secrets | length) == 0 then "no runtime config found (zero secrets)"
  elif (.secrets | length) > 256 then "more than 256 variables"
  elif any(.secrets[]; type != "object" or (.secretKey | type) != "string"
                       or (.secretValue | type) != "string") then "secret without string name/value"
  elif any(.secrets[]; .secretKey | name_ok | not) then "invalid variable name"
  elif any(.secrets[]; .secretKey | reserved) then "reserved variable name (BOM_*, PATH, NODE_OPTIONS, LD_*)"
  elif any(.secrets[]; .secretValue | @base64 | length > 65536) then "value too large (base64 > 65536 chars)"
  elif ([.secrets[].secretKey] | length) != ([.secrets[].secretKey] | unique | length) then "duplicate variable name"
  else "ok" end'

# Builds the whole stream (lines NAME<TAB>base64(value), then .END<TAB>N) in memory, so a failed
# or bad fetch means ssh is never started. jq's stderr is discarded: its errors can quote input.
# printf | jq, never a here-string: bash may back here-strings with a temp file.
bundle() {
  local json why out
  json="$(fetch_json)" && [ -n "$json" ] || { echo "fetching runtime config failed" >&2; return 1; }
  why="$(printf '%s' "$json" | jq -r "$CHECK" 2>/dev/null)" || why="response is not valid JSON"
  [ "$why" = ok ] || { echo "refusing to push: ${why:-response is not valid JSON}" >&2; return 1; }
  out="$(printf '%s' "$json" \
    | jq -r '(.secrets[] | "\(.secretKey)\t\(.secretValue | @base64)"), ".END\t\(.secrets | length)"' 2>/dev/null)" \
    && [ -n "$out" ] || { echo "encoding runtime config failed" >&2; return 1; }
  printf '%s\n' "$out"
}

push() {
  local b
  b="$(bundle)" || return 1
  printf '%s\n' "$b" | remote put   # printf is a builtin: the bundle never appears in argv
}

# The pending marker survives a failed redeploy, so the next run retries it even though the box
# now reports files>0.
ensure() {
  local st
  st="$(remote status)" || return 1
  case "$st" in
    files=0)
      echo "box has no runtime config (rebooted?); re-pushing" >&2
      (umask 077; mkdir -p "$STATE_DIR") && : > "$PENDING" || return 1   # new dirs 0700
      push || return 1
      remote redeploy || return 1
      rm -f "$PENDING" ;;
    files=[1-9]*)
      if [ -e "$PENDING" ]; then
        # If an earlier redeploy is still running on the box (we timed out locally), this one fails
        # on the taken bom-redeploy unit name; the marker stays and the following run retries.
        echo "redeploy pending from an earlier run; retrying" >&2
        remote redeploy || return 1
        rm -f "$PENDING"
      fi ;;
    *) echo "unexpected status reply from box" >&2; return 1 ;;
  esac
}

case "${1:-}" in
  push)          push ;;
  status)        remote status ;;
  redeploy)      remote redeploy && rm -f "$PENDING" ;;     # a manual redeploy also settles ensure
  push-redeploy) push && remote redeploy && rm -f "$PENDING" ;;
  ensure)        ensure ;;
  *)             usage; exit 64 ;;
esac
```

The bundle exists only in shell variables and pipes (no here-strings, which bash may back with a temp file); nothing is written to disk on homeserver. It is built completely before ssh starts, so a failed, empty, or malformed Infisical response means no connection to the box at all. It always ends with `.END<TAB>N`, and the receiver commits only when it sees that trailer and N matches the number of lines it got. The Infisical client secret reaches jq via `--rawfile` and curl via stdin; the access token reaches curl via `-K -` (stdin), so neither shows in `ps`. Rotate with `push-redeploy`: a plain `push` leaves running containers on the previous bundle and breaks `docker exec` one-off jobs until a redeploy.

Other guards: `set +x` at the top (an inherited `SHELLOPTS=xtrace` would otherwise trace values). ssh runs with `-F none`, a pinned host key (`~/.ssh/bom_secrets_known_hosts`, alias `bom-prod`, `StrictHostKeyChecking=yes`), and `-n` for everything but `put`. It is wrapped in `timeout 1800`; the box runs `redeploy` in its own systemd unit, so cutting the session does not cut the deploy. curl gets `-q` so no `~/.curlrc` applies. The receiver's name, reserved-name, count, size and duplicate rules are checked locally first so a bad Infisical entry fails with a clear message and no connection. `ensure` keeps a marker (`${BOM_SECRETS_STATE_DIR:-~/.cache}/bom-secrets-redeploy-pending`, on disk so it survives a homeserver reboot; the marker holds no data) from before its push until its redeploy succeeds, so a failed redeploy is retried on the next run even though the box then reports `files>0`. A successful manual `redeploy` or `push-redeploy` also clears it. The canned-JSON hook works only with `BOM_SECRETS_TEST=1`. `include_imports` is not requested: imported secrets come back in a separate `.imports` list, which the script would need to merge; keep `/bom-runtime` free of imports instead.

**Step 4: Run to verify it passes** — same command; Expected: 39 passing. Also `bash -n scripts/bom-secrets-push.sh` and `shellcheck scripts/bom-secrets-push.sh` (clean).

**Step 5: Commit**

```bash
chmod 0755 scripts/bom-secrets-push.sh
git add -f scripts/bom-secrets-push.sh   # *.sh is gitignored
git add scripts/test/bom-secrets-push.test.mjs
git commit -m "feat(ops): homeserver pushes runtime config one-way to box RAM"
```

---

### Task 6: Move runtime values into Infisical `/bom-runtime`

The container's variable names must match exactly what the app reads today (20 + 13 vars from the old `.env`/`mail.env`, minus the non-secret flags now passed with `-e`).

**Step 1: Create folder** — Infisical UI: BoMOnline → Production → New folder `bom-runtime`.

**Step 2: Copy values from AWS once, without printing them** (run on the Mac with `OfficeAWS` and the logged-in `infisical` CLI):

```bash
export BOM_INFISICAL_PROJECT="<BoMOnline project id: Infisical UI → Project settings, or homeserver's .prod-project-id>"
TOKEN=$(infisical user get token --plain) python3 -I - <<'EOF'
import json, os, subprocess, urllib.request
B, W = 'https://secrets.kckern.net/api', os.environ['BOM_INFISICAL_PROJECT']
vals = {}
for sid in ('bom/prod/db', 'bom/prod/openai', 'bom/prod/app', 'bom/prod/mail'):
    out = subprocess.run(['aws','secretsmanager','get-secret-value','--region','us-west-2','--secret-id',sid,
                          '--query','SecretString','--output','text'], capture_output=True, text=True, check=True).stdout
    vals.update(json.loads(out))
for k, v in sorted(vals.items()):
    req = urllib.request.Request(f'{B}/v3/secrets/raw/{k}', method='POST',
        data=json.dumps({'workspaceId': W, 'environment': 'prod', 'secretPath': '/bom-runtime',
                         'secretValue': v, 'type': 'shared'}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['TOKEN'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r: print(k, r.status)
print('copied', len(vals))
EOF
```
Expected: 25 lines ending in `200` (5 db + 2 openai + 5 app + 13 mail), then `copied 25`. If any key already exists the API returns 400; re-run that key with `method='PATCH'`.

**Step 3: Verify by name only**

Run: `infisical export --projectId "$BOM_INFISICAL_PROJECT" --env prod --path /bom-runtime --format json | jq -r '.[].key' | sort`
Expected: the same key names as `jq -r 'keys[]'` over the four AWS secrets; must include `MYSQL_PASSWORD`, `MYSQL_USER`, `MYSQL_HOST`, `OPENAI_BOT_API_KEY`, `OPENAI_EMBED_API_KEY`, `MAIL_FROM`.

**Step 4: Confirm the `bom-dev` identity can read the folder** (on homeserver as `bom`):

Run: `BOM_SECRETS_KEY=/dev/null bash -c 'source <(sed -n "/^fetch_json()/,/^}/p" scripts/bom-secrets-push.sh); fetch_json | jq ".secrets | length"'`
Expected: the same count. If 403, grant the identity read on `prod` `/bom-runtime` in project access control.

---

### Task 7: Install the receiver and the one-way key on the box

**Step 1: Key on homeserver (as `bom`)**

```bash
ssh-keygen -t ed25519 -N '' -C 'bom@homeserver secrets-push' -f ~/.ssh/bom_secrets_ed25519
cat ~/.ssh/bom_secrets_ed25519.pub
```

**Step 1b: Pin the box's host key (as `bom` on homeserver)**. The push script uses `StrictHostKeyChecking=yes` with its own known_hosts file and alias `bom-prod`, so it never trusts a key on first use. From the Mac's Instance Connect session (`ssh ubuntu@52.42.0.250`), run `cat /etc/ssh/ssh_host_ed25519_key.pub; ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. Cross-check that fingerprint over a channel that does not depend on that SSH session, for example `aws ssm send-command --instance-ids i-02c9619a48343a8d9 --document-name AWS-RunShellScript --parameters 'commands=["ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub"]'` and then `aws ssm get-command-invocation`. Then on homeserver:

```bash
umask 077
printf 'bom-prod %s\n' 'ssh-ed25519 AAAA...<key from the box>' > ~/.ssh/bom_secrets_known_hosts
ssh-keygen -lf ~/.ssh/bom_secrets_known_hosts   # Expected: the same SHA256 fingerprint as on the box
```

**Step 2: Receiver user on the box** (EC2 Instance Connect as `ubuntu`)

```bash
sudo useradd --system --create-home --shell /bin/sh bomsecrets
sudo install -o root -g root -m 0755 /dev/stdin /usr/local/sbin/bom-secrets-receive < secrets-receive.sh   # copy from the repo
echo 'Defaults!/usr/local/sbin/bom-secrets-receive env_keep += "SSH_ORIGINAL_COMMAND"
Defaults!/usr/local/sbin/bom-secrets-receive !log_input,!log_output
bomsecrets ALL=(root) NOPASSWD: /usr/local/sbin/bom-secrets-receive' | sudo tee /etc/sudoers.d/bom-secrets >/dev/null
sudo chmod 0440 /etc/sudoers.d/bom-secrets && sudo visudo -cf /etc/sudoers.d/bom-secrets
sudo install -d -o bomsecrets -g bomsecrets -m 0700 /home/bomsecrets/.ssh
echo 'restrict,command="sudo -n /usr/local/sbin/bom-secrets-receive" <PASTE PUBKEY>' | sudo tee /home/bomsecrets/.ssh/authorized_keys >/dev/null
sudo chown bomsecrets:bomsecrets /home/bomsecrets/.ssh/authorized_keys && sudo chmod 0600 /home/bomsecrets/.ssh/authorized_keys
```
Expected: `visudo` prints `parsed OK`.

**Step 3: Prove the key can do nothing else** (from homeserver as `bom`)

```bash
pin=(-F none -i ~/.ssh/bom_secrets_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
     -o UserKnownHostsFile=$HOME/.ssh/bom_secrets_known_hosts -o HostKeyAlias=bom-prod)
ssh "${pin[@]}" bomsecrets@52.42.0.250 'id'          # Expected: usage line, exit 64
ssh "${pin[@]}" -tt bomsecrets@52.42.0.250           # Expected: usage line, no shell
ssh "${pin[@]}" -L 3306:localhost:3306 bomsecrets@52.42.0.250 status  # Expected: files=0; forwarding refused
scripts/bom-secrets-push.sh status                                      # Expected: files=0
```

**Step 4: First push** — `scripts/bom-secrets-push.sh push` → Expected: `stored=N` (N = Task 6 count). Then `status` → `files=N`. On the box: `sudo ls -la /run/bom-secrets` shows N files mode `-r--------` root, dir `drwx------`; `findmnt -no FSTYPE --target /run` → `tmpfs`.

Before cutover use `push` only, never `push-redeploy`. The receiver's `redeploy` runs `/home/ubuntu/greenfield/deploy-blue-green.sh`, and the SSM `bom-deploy` document only rewrites that file when CI deploys. Until the first CI deploy of the new script (Task 8 Step 1) it is still the old Secrets Manager script, which does not know `--redeploy-active`.

---

### Task 8: Cutover (deploy via CI) and verify

**Step 1:** Merge Tasks 1-5 to `dev`, run `node --test ops/production/test/ ops/container/test/ scripts/test/` (all pass), then merge `dev` → `prod` and push. CI builds the new image (with ENTRYPOINT) and SSM runs the new deploy script.

**Step 2: Watch the deploy** — GitHub Actions `deploy-prod` log shows "candidate … is healthy", "gateway switched", "deployment complete". If it fails with "runtime config not present", run Task 7 Step 4 and re-run the workflow.

Then confirm SSM installed the new script (the receiver's `redeploy` depends on it): `test -x /home/ubuntu/greenfield/deploy-blue-green.sh && grep -q -- --redeploy-active /home/ubuntu/greenfield/deploy-blue-green.sh && echo new-script` → `new-script`. Only after this may homeserver use `push-redeploy`.

**Step 2b: Install the new rollback script** — SSM only writes `deploy-blue-green.sh`, so the bundle-aware `rollback-blue-green.sh` must be installed by hand from the repo at the deployed commit (e.g. a checkout at that SHA, or `curl -fsSL https://raw.githubusercontent.com/kckern/BookofMormonOnline/<deployed-sha>/ops/production/rollback-blue-green.sh -o ops/production/rollback-blue-green.sh`):

```bash
sudo install -m 0755 ops/production/rollback-blue-green.sh /home/ubuntu/greenfield/
grep -q 'runtime config not present' /home/ubuntu/greenfield/rollback-blue-green.sh && echo new-rollback   # Expected: new-rollback
```

**Step 3: Verify no values on disk or in Docker config** (on the box)

```bash
A=$(sudo cat /home/ubuntu/greenfield/active-slot)
sudo docker inspect "$A" --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1   # Expected: no MYSQL_PASSWORD / OPENAI_* names
sudo docker inspect "$A" --format '{{range .Mounts}}{{.Source}}->{{.Destination}} {{.RW}}{{end}}'  # Expected: /run/bom-secrets->/run/secrets false
sudo docker exec "$A" sh -c 'cat /proc/1/environ | tr "\0" "\n" | grep -c ^MYSQL_PASSWORD='  # tini's env: Expected 0
```

Do not run the `config.v2.json` value check yet (it is in Step 5). The stopped rollback slot is the old env-file container, so its `config.v2.json` still holds the values and the count is 1 here. It reaches 0 only after Step 5's redeploy replaces that slot.

**Step 4: Verify the app works** — `curl -s -o /dev/null -w '%{http_code}' https://bookofmormon.online/` → 200; GraphQL `{__typename}` → 200; `sudo docker logs --since 5m "$A" 2>&1 | grep -ciE 'access denied|ER_ACCESS|OPENAI.*401'` → 0. Send one transactional email from the app (password reset to your own address) and confirm receipt.

**Step 5: Purge the old env-file rollback slot (REQUIRED)** — once Step 2 confirmed the new script, on homeserver as `bom`: `scripts/bom-secrets-push.sh push-redeploy`. A redeploy never takes the no-op exit, so it removes the old env-file rollback slot and replaces it with a bundle-mounted one. (A README-only push does not do this: `deploy-prod.yml` has `paths-ignore: docs/**, **/*.md`, and a `workflow_dispatch` of the already-deployed commit may no-op.) Then, on the box:

```bash
sudo journalctl -u bom-redeploy -n 80 --no-pager | grep -E 'removing inactive slot|deployment complete'   # Expected: both lines
sudo sh -c 'grep -lF -- "$(head -c 12 /run/bom-secrets/MYSQL_PASSWORD)" /var/lib/docker/containers/*/config.v2.json 2>/dev/null | wc -l'   # Expected 0
```
(`sudo sh -c` so the glob expands as root; `-F --` so the value is a fixed string, never a pattern or option.)

**Step 5b: Verify an upgrade needs no secrets** — with the next real (non-doc) change merged to `prod`: CI deploys a new digest, healthy, with no homeserver action.

**Step 6: Verify one-off jobs** — run the `ingest-group-covers` workflow in dry-run mode (no `APPLY`). Expected: connects to DB, exits 0.

---

### Task 9: Reboot recovery timer on homeserver

**Files:**
- Create: `ops/homeserver/bom-secrets-ensure.service`
- Create: `ops/homeserver/bom-secrets-ensure.timer`
- Create: `scripts/test/bom-secrets-ensure-units.test.mjs` (asserts `ensure`, `Type=oneshot`, `TimeoutStartSec>=2100`, `OnBootSec`, `OnUnitActiveSec=5min`; on Linux also run `systemd-analyze --user verify ops/homeserver/bom-secrets-ensure.*`)

**Step 1: Units**

```ini
# ops/homeserver/bom-secrets-ensure.service
[Unit]
Description=Re-push BoM runtime config to EC2 RAM if the box lost it (reboot)
[Service]
Type=oneshot
ExecStart=%h/BookofMormonOnline/scripts/bom-secrets-push.sh ensure
# ssh is capped at 1800 s (timeout in the script); a redeploy can wait up to 900 s for the
# deploy lock and then needs the deploy time itself. 2100 s leaves room for the push before it.
TimeoutStartSec=2100
```

```ini
# ops/homeserver/bom-secrets-ensure.timer
[Unit]
Description=Check EC2 runtime config every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
```

**Step 2: Install (as `bom`)**

User timers only run while `bom` is logged in unless lingering is enabled. As an admin: `sudo loginctl enable-linger bom`, then `loginctl show-user bom -p Linger` → `Linger=yes`. (On this homeserver it already reports `Linger=yes`; the command is idempotent.)

```bash
cp ops/homeserver/bom-secrets-ensure.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now bom-secrets-ensure.timer
systemctl --user start bom-secrets-ensure.service && journalctl --user -u bom-secrets-ensure -n 5 --no-pager
```
Expected: service succeeds silently (box reports files>0).

**Step 3: Reboot drill (quiet hour)** — `aws ec2 reboot-instances --instance-ids i-02c9619a48343a8d9`. Expected within ~7 min: journal shows "re-pushing", then the redeploy completes and the site returns 200. Note: during that window the app container fails to START. Its bind source `/run/bom-secrets` is gone with the tmpfs, so Docker cannot create the mount, and the site serves gateway errors. The receiver's `redeploy` then first `docker start`s the dead active slot (log: "restarted active slot … after runtime config restore"), so the site is back within seconds, and then runs the normal blue/green redeploy. (Exit 78 from the entrypoint only happens if the directory exists but has no `MYSQL_PASSWORD`.) This is the intended fail-closed behavior.

Drill finding (2026-11-01): after the reboot, the active slot (green) failed to start because its bind source was missing. The gateway `bookofmormon-online` (restart=always) crash-looped because its upstream host did not resolve. The re-push and `--redeploy-active` got candidate blue healthy, but the switch's `docker exec` into the gateway failed with "Container … is restarting", so the script restored green and exited 1. The site stayed down until `docker start bookofmormon-online-green` by hand. Docker reports `State.Running=true` for a restarting container, which is why the old "start the gateway if not running" guard did not catch it. Fixed in `deploy-blue-green.sh`:
- Redeploy mode starts a non-running active slot (and waits for health) before prune, pull and the candidate. It then applies the gateway config for that slot at once, which pulls the gateway out of crash-loop backoff. If the slot doesn't come back, it logs and carries on. Restarts from before the wait don't count against health (RestartCount is compared to a baseline).
- Every gateway reload goes through `apply_gateway_config`. It uses `docker exec … nginx -t/-s reload` only when `{{.State.Status}}` is `running` and the reload succeeds. Otherwise it `docker restart`s the gateway on the rendered config and waits (up to `BOM_GATEWAY_TIMEOUT`, default 60 s) until it is running and `nginx -t` passes.
- On a failed switch or verification, the gateway is restored to the old active slot only if that slot is running and healthy. Otherwise the candidate is kept (not removed), the gateway stays on it, `active-slot` records it, and the deploy still fails (DeployFailed=1).
- `rollback-blue-green.sh` uses the same restart-and-wait logic (duplicated, because SSM ships only the deploy script). It writes `active-slot` only after the gateway serves the rollback slot. On failure it re-renders the config for the active slot and stops the rollback slot again.
Re-run this drill to confirm; expected now: no manual step, and `journalctl -u bom-redeploy` shows the "restarted active slot" line and "deployment complete".

After the redeploy, check that the old active slot will not come back alongside the new one on the next dockerd restart:

```bash
A=$(sudo cat /home/ubuntu/greenfield/active-slot)
for c in bookofmormon-online-blue bookofmormon-online-green; do [ "$c" = "$A" ] || sudo docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}} {{.State.Running}}' "$c"; done
# Expected: /<inactive slot> no false
```

**Step 4: Commit**

```bash
git add ops/homeserver/
git commit -m "feat(ops): homeserver timer restores EC2 runtime config after reboot"
```

---

### Task 10: Remove the old secret stores

Only after Task 8 Steps 3-6 and Task 9 Step 3 pass, **and** the Task 8 Step 5 `config.v2.json` grep prints `0` (no container config on disk still holds a value).

**Step 0: Confirm nothing else reads the old stores** (on the box, then from the Mac)

```bash
sudo grep -rlE 'secretsmanager|greenfield/(\.env|mail\.env)' /etc/cron* /etc/systemd /usr/local/sbin /usr/local/bin /home/ubuntu /root 2>/dev/null
aws iam get-role-policy --role-name bomdocker-role --policy-name BomSecretsRead --query 'PolicyDocument.Statement[].Resource' --output json
```
Expected: the grep lists only `/home/ubuntu/greenfield/migrate-blue-green.sh` (stale: it is the one-time initial cutover script and still uses `--env-file`; never run it again) and nothing else. Investigate any other hit before continuing. The policy's resources are only `…:secret:bom/prod/*` ARNs; if it covers anything else, another consumer may need it, so stop and check.

**Step 1: Remove the role's read access**

```bash
aws iam delete-role-policy --role-name bomdocker-role --policy-name BomSecretsRead
```
Expected: no output. The next non-doc CI deploy (as in Task 8 Step 5b) must still succeed.

**Step 2: Schedule deletion of the AWS secrets (7-day recovery window)**

```bash
for s in bom/prod/db bom/prod/openai bom/prod/app bom/prod/mail; do
  aws secretsmanager delete-secret --region us-west-2 --secret-id "$s" --recovery-window-in-days 7 --query DeletionDate --output text
done
```
Rollback within 7 days: `aws secretsmanager restore-secret --secret-id <name>`.

**Step 3: Delete the env files on the box**

```bash
sudo rm -f /home/ubuntu/greenfield/.env /home/ubuntu/greenfield/mail.env /home/ubuntu/greenfield/secrets-hash
sudo find / -xdev -name '.env' -path '*greenfield*' 2>/dev/null   # Expected: nothing
```

**Step 4: Update docs** — `docs/reference/deployment.md` and `ops/production/README.md`: replace the Secrets Manager section with "Runtime config: Infisical prod `/bom-runtime` → `scripts/bom-secrets-push.sh` → `/run/bom-secrets` (tmpfs) → container `/run/secrets`. Rotate: edit Infisical, then `bom-secrets-push.sh push-redeploy`."

**Step 5: Commit**

```bash
git add docs/reference/deployment.md ops/production/README.md
git commit -m "docs(ops): runtime config is RAM-only, pushed from homeserver"
```

---

### Rotation runbook (after cutover)

1. Change the value in Infisical (prod `/bom-runtime`).
2. On homeserver as `bom`: `scripts/bom-secrets-push.sh push-redeploy`. Always rotate with `push-redeploy`, not a plain `push`. A push swaps `/run/bom-secrets` for a new directory, while the running slot's bind mount still points at the swapped-out one. The app keeps its loaded env, but `docker exec … entrypoint.sh` one-off jobs (ingest workflows) fail until a redeploy.
3. Expected: `stored=N`, then the blue/green log ending "deployment complete"; site 200.

After a `push-redeploy`, both slots run the same image (the redeploy reuses the active digest), so `rollback-blue-green.sh` no longer undoes a code release. To undo a bad release, deploy the previous digest via CI: re-run an earlier `deploy-prod` run only if it ran after the cutover (Task 8 Step 1), since an older run would reinstall the Secrets Manager deploy script. Otherwise revert the bad change on `prod`.

### Rollback (any time before Task 10)

1. First, on homeserver as `bom`: `systemctl --user disable --now bom-secrets-ensure.timer`. After the revert, do not use `redeploy` or `push-redeploy`. The old deploy script ignores `--redeploy-active` and, with no `BOM_IMAGE`, falls back to the stale `desired-image` pin.
2. `git revert` all Task 4 commits on `prod` (newest first) and push: CI redeploys with the old Secrets Manager path (AWS secrets and `BomSecretsRead` still exist until Task 10). On `feat/ram-only-runtime-secrets` (after the rebase onto `origin/prod`) they are:

   - `d9a30306` fix(ops): old active slot gets restart=no even when it is not running
   - `c38ede78` fix(ops): deploy hardening from review (also the rollback-script bundle check)
   - `66791feb` fix(ops): never touch rollback slot without runtime bundle; redeploy requires digest
   - `cf80d955` feat(ops): deploy mounts tmpfs runtime config; drop Secrets Manager and .env

   `git revert d9a30306 c38ede78 66791feb cf80d955`. If the branch was squashed or rebased again into `prod`, use the matching SHAs there. Reverting `cf80d955` also removes the README/systemd "retired" notes; do not re-enable `bom-deploy.timer` anyway. Reinstall the reverted `rollback-blue-green.sh` on the box as in Task 8 Step 2b if it was installed.
