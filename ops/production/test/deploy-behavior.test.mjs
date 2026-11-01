// Behavioral tests: run the real deploy/rollback scripts under `sh` (dash in prod)
// against stubbed docker/flock/df/aws/curl/cosign that log every call.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const DEPLOY = resolve(root, 'deploy-blue-green.sh')
const ROLLBACK = resolve(root, 'rollback-blue-green.sh')
const BLUE = 'bookofmormon-online-blue'
const GREEN = 'bookofmormon-online-green'
const DIGEST = 'kckern/bookofmormon-online@sha256:' + 'a'.repeat(64)

// Stateful enough for recovery paths: `docker start|restart X` makes X running
// (recorded in $STUB_STARTED); the gateway can be held in $STUB_GW_STATUS
// (e.g. restarting) until restarted; `docker exec` into a non-running container fails.
const DOCKER_STUB = `#!/bin/sh
echo "docker $*" >> "$STUB_CALLS"
in_list() { case " $2 " in *" $1 "*) return 0 ;; esac; return 1; }
status_of() {
  if grep -qx -- "$1" "$STUB_STARTED" 2>/dev/null; then echo running
  elif [ "$1" = bookofmormon-online ] && [ -n "\${STUB_GW_STATUS:-}" ]; then echo "$STUB_GW_STATUS"
  elif in_list "$1" "$STUB_RUNNING"; then echo running
  else echo exited; fi
}
if [ "$1 $2" = "container inspect" ]; then
  if [ "$3" = "-f" ]; then
    name="$5"
    st="$(status_of "$name")"
    case "$4" in
      # like Docker: a restarting container reports Running=true
      '{{.State.Running}}') case "$st" in running|restarting) echo true ;; *) echo false ;; esac ;;
      '{{.State.Status}}') echo "$st" ;;
      '{{.Config.Image}}') echo "$STUB_REF" ;;
      '{{.Image}}') echo "$STUB_ACTIVE_IMAGE" ;;
      # STUB_RESTARTS_GROW=1: the count rises by one on every query (a live restart loop)
      '{{.RestartCount}}') if [ "\${STUB_RESTARTS_GROW:-0}" = 1 ]; then
          echo "$name" >> "$STUB_STARTED.rc"; grep -cx -- "$name" "$STUB_STARTED.rc"
        else echo "\${STUB_RESTARTS:-0}"; fi ;;
      *Mounts*) echo "\${STUB_MOUNT_SRC:-}" ;;
      # STUB_START_POLLS=N: a started container reports "starting" for its first N health polls
      *Health*) if [ "$st" = running ]; then
          echo "$name" >> "$STUB_STARTED.hp"
          if [ "$(grep -cx -- "$name" "$STUB_STARTED.hp")" -gt "\${STUB_START_POLLS:-0}" ]; then echo healthy; else echo starting; fi
        else echo "\${STUB_HEALTH:-healthy}"; fi ;;
    esac
    exit 0
  fi
  in_list "$3" "$STUB_EXISTS"; exit $?
fi
case "$1" in
  pull) [ "\${STUB_FAIL_PULL:-0}" = 1 ] && exit 1 ;;
  image) [ "$2" = inspect ] && echo "$STUB_IMAGE_ID" ;;
  start|restart) [ "\${STUB_NO_RESTART:-0}" = 1 ] || echo "$2" >> "$STUB_STARTED" ;;
  exec)
    if [ "$(status_of "$2")" != running ]; then
      echo "Error response from daemon: Container $2 is $(status_of "$2")" >&2
      exit 1
    fi ;;
esac
exit 0
`

function harness(t) {
  const dir = mkdtempSync(join(tmpdir(), 'bom-deploy-behavior-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const bin = join(dir, 'bin')
  const base = join(dir, 'base')
  const secrets = join(dir, 'secrets')
  for (const d of [bin, join(base, 'gateway'), secrets]) mkdirSync(d, { recursive: true })
  const calls = join(dir, 'calls.log')
  const started = join(dir, 'started.list')
  const stub = (path, body) => { writeFileSync(path, body); chmodSync(path, 0o755) }
  stub(join(bin, 'docker'), DOCKER_STUB)
  stub(join(bin, 'flock'), '#!/bin/sh\necho "flock $*" >> "$STUB_CALLS"\nexit "${STUB_FLOCK_RC:-0}"\n')
  stub(join(bin, 'df'), '#!/bin/sh\necho "Filesystem 1 2 3 x /"\necho "x 1 2 3 ${STUB_DISK:-10}% /"\n')
  stub(join(bin, 'aws'), '#!/bin/sh\necho "aws $*" >> "$STUB_CALLS"\n')
  stub(join(bin, 'curl'), '#!/bin/sh\necho "curl $*" >> "$STUB_CALLS"\nexit 1\n')
  stub(join(base, 'cosign'), '#!/bin/sh\necho "cosign $*" >> "$STUB_CALLS"\n')
  writeFileSync(join(base, 'gateway', 'default.conf.template'), 'upstream __ACTIVE_SLOT__;\n')
  const bundle = (value) => writeFileSync(join(secrets, 'MYSQL_PASSWORD'), value)

  function run(script, args = [], env = {}) {
    writeFileSync(calls, '')
    for (const f of [started, `${started}.rc`, `${started}.hp`]) writeFileSync(f, '')
    writeFileSync(join(base, 'active-slot'), `${BLUE}\n`) // rollback/deploy flip it
    const r = spawnSync('sh', [script, ...args], {
      encoding: 'utf8',
      timeout: 30000,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        STUB_CALLS: calls,
        STUB_STARTED: started,
        BOM_DEPLOY_DIR: base,
        BOM_SECRETS_DIR: secrets,
        BOM_IMAGE: DIGEST,
        BOM_INSTANCE_ID: 'i-test',
        BOM_DRAIN_SECONDS: '0',
        BOM_HEALTH_TIMEOUT: '20',
        STUB_EXISTS: `${BLUE} ${GREEN} bookofmormon-online`,
        STUB_RUNNING: `${BLUE} bookofmormon-online`,
        STUB_REF: DIGEST,
        STUB_ACTIVE_IMAGE: 'sha256:old',
        STUB_IMAGE_ID: 'sha256:new',
        ...env,
      },
    })
    const log = readFileSync(calls, 'utf8').split('\n').filter(Boolean)
    const metrics = log.filter((l) => l.startsWith('aws cloudwatch put-metric-data'))
    return { ...r, log, metrics, has: (re) => log.some((l) => re.test(l)) }
  }
  return { run, bundle, secrets }
}

const SLOT_MUTATION = /^docker (rm|run|stop|start|update --restart=always)\b/

test('empty bundle + deploy needing a candidate fails without touching either slot, reported once', (t) => {
  const h = harness(t)
  h.bundle('')
  const r = h.run(DEPLOY)
  assert.notEqual(r.status, 0, r.stderr)
  assert.match(r.stderr, /runtime config not present/)
  assert.ok(!r.has(SLOT_MUTATION), r.log.join('\n'))
  assert.equal(r.metrics.length, 1)
  assert.match(r.metrics[0], /Value=1/)
})

test('--redeploy-active redeploys a healthy digest-pinned active slot (no no-op)', (t) => {
  const h = harness(t)
  h.bundle('x')
  const r = h.run(DEPLOY, ['--redeploy-active'], { STUB_ACTIVE_IMAGE: 'sha256:same', STUB_IMAGE_ID: 'sha256:same', BOM_IMAGE: 'kckern/bookofmormon-online@sha256:' + 'b'.repeat(64) })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.has(new RegExp(`^docker pull ${DIGEST.replace(/[.@]/g, '\\$&')}$`)), 'pulls the active digest, not BOM_IMAGE')
  assert.ok(r.has(/^cosign verify .* kckern\/bookofmormon-online@sha256:a+$/))
  assert.ok(r.has(new RegExp(`^docker run -d .*--name ${GREEN} `)))
  assert.ok(r.has(/^flock -w 900 9$/), 'redeploy waits for the lock')
  assert.equal(r.metrics.length, 1)
  assert.match(r.metrics[0], /Value=0/)
})

test('--redeploy-active with a non-digest active image fails before pull', (t) => {
  const h = harness(t)
  h.bundle('x')
  const r = h.run(DEPLOY, ['--redeploy-active'], { STUB_REF: 'kckern/bookofmormon-online:prod' })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /not pinned by digest/)
  assert.ok(!r.has(/^docker pull/))
  assert.ok(!r.has(SLOT_MUTATION))
})

test('disk >= 90% without a bundle keeps the rollback slot', (t) => {
  const h = harness(t)
  const r = h.run(DEPLOY, [], { STUB_DISK: '95' })
  assert.notEqual(r.status, 0)
  assert.ok(!r.has(/^docker rm /), r.log.join('\n'))
  assert.ok(!r.has(/^docker system prune/))
})

test('bad arguments exit with usage before doing anything', (t) => {
  const h = harness(t)
  for (const args of [['--bogus'], ['--redeploy-active', 'extra']]) {
    const r = h.run(DEPLOY, args)
    assert.equal(r.status, 64, `${args}: ${r.stderr}`)
    assert.match(r.stderr, /usage/i)
    assert.deepEqual(r.log, [])
  }
})

test('a set -e failure (pull error) still reports DeployFailed=1 exactly once', (t) => {
  const h = harness(t)
  h.bundle('x')
  const r = h.run(DEPLOY, [], { STUB_FAIL_PULL: '1' })
  assert.notEqual(r.status, 0)
  assert.equal(r.metrics.length, 1, r.log.join('\n'))
  assert.match(r.metrics[0], /Value=1/)
})

test('lock contention: normal deploy exits 0 unreported; redeploy fails loudly', (t) => {
  const h = harness(t)
  h.bundle('x')
  const normal = h.run(DEPLOY, [], { STUB_FLOCK_RC: '1' })
  assert.equal(normal.status, 0)
  assert.ok(normal.has(/^flock -n 9$/))
  assert.equal(normal.metrics.length, 0)
  const redeploy = h.run(DEPLOY, ['--redeploy-active'], { STUB_FLOCK_RC: '1' })
  assert.notEqual(redeploy.status, 0)
  assert.match(redeploy.stderr, /lock busy; redeploy not applied/)
  assert.ok(!redeploy.has(/^docker pull/))
  assert.equal(redeploy.metrics.length, 1)
})

test('a restart-looping candidate fails fast and the active slot is kept', (t) => {
  const h = harness(t)
  h.bundle('x')
  const started = Date.now()
  const r = h.run(DEPLOY, [], { STUB_HEALTH: 'starting', STUB_RESTARTS_GROW: '1' })
  assert.notEqual(r.status, 0)
  assert.ok(Date.now() - started < 10000, 'did not wait out the health timeout')
  assert.ok(r.has(new RegExp(`^docker logs --tail 100 ${GREEN}$`)))
  assert.ok(r.has(new RegExp(`^docker rm -f ${GREEN}$`)))
  assert.ok(!r.has(/nginx -s reload/))
  assert.ok(!r.has(new RegExp(`^docker stop .*${BLUE}$`)))
})

test('rollback refuses a bundle-mounted slot when the bundle is missing', (t) => {
  const h = harness(t)
  const r = h.run(ROLLBACK, [], { STUB_MOUNT_SRC: h.secrets })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /runtime config/)
  assert.ok(!r.has(SLOT_MUTATION), r.log.join('\n'))
})

test('rollback proceeds for a bundle-mounted slot with the bundle, and for env-file slots', (t) => {
  const h = harness(t)
  const withMount = h.run(ROLLBACK, [], { STUB_MOUNT_SRC: h.secrets, STUB_RUNNING: '' })
  assert.notEqual(withMount.status, 0, 'precondition: empty bundle refused')
  h.bundle('x')
  for (const env of [{ STUB_MOUNT_SRC: h.secrets }, { STUB_MOUNT_SRC: '' }]) {
    const r = h.run(ROLLBACK, [], env)
    assert.equal(r.status, 0, r.stderr)
    assert.ok(r.has(new RegExp(`^docker update --restart=always ${GREEN}$`)))
    assert.ok(r.has(new RegExp(`^docker start ${GREEN}$`)))
  }
})

test('a dead (not running) old active slot still gets restart=no after the switch', (t) => {
  const h = harness(t)
  h.bundle('x')
  // e.g. after a reboot: blue is recorded active and exists but did not start
  const r = h.run(DEPLOY, [], { STUB_RUNNING: 'bookofmormon-online' })
  assert.equal(r.status, 0, r.stderr)
  const switched = r.log.findIndex((l) => /nginx -s reload/.test(l))
  const update = r.log.findIndex((l) => l === `docker update --restart=no ${BLUE}`)
  assert.ok(switched !== -1 && update > switched, r.log.join('\n'))
  assert.ok(!r.has(new RegExp(`^docker stop .*${BLUE}$`)), 'nothing to drain')
})

test('redeploy after a reboot starts the dead active slot before the candidate', (t) => {
  const h = harness(t)
  h.bundle('x')
  // blue (active) did not come back after the reboot; only the gateway "runs"
  const r = h.run(DEPLOY, ['--redeploy-active'], { STUB_RUNNING: '', STUB_GW_STATUS: 'restarting' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr + r.stdout, new RegExp(`restarted active slot ${BLUE} after runtime config restore`))
  const start = r.log.indexOf(`docker start ${BLUE}`)
  const run = r.log.findIndex((l) => l.startsWith('docker run -d'))
  assert.ok(start !== -1 && run !== -1 && start < run, r.log.join('\n'))
  assert.ok(r.has(new RegExp(`^docker stop --time 30 ${BLUE}$`)), 'then blue/green proceeds and drains blue')
})

test('a restarting gateway is restarted with the rendered config instead of exec-reloaded', (t) => {
  const h = harness(t)
  h.bundle('x')
  const r = h.run(DEPLOY, [], { STUB_GW_STATUS: 'restarting' })
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stderr + r.stdout, /gateway rejected/)
  const restart = r.log.indexOf('docker restart bookofmormon-online')
  assert.notEqual(restart, -1, r.log.join('\n'))
  assert.ok(!r.log.slice(0, restart).some((l) => /^docker exec bookofmormon-online nginx/.test(l)), 'no exec into the restarting gateway')
  assert.match(r.stdout + r.stderr, /gateway switched to bookofmormon-online-green/)
  assert.ok(r.has(/^docker stop --time 30 bookofmormon-online-blue$/))
})

test('a gateway that never recovers still restores the active config and fails', (t) => {
  const h = harness(t)
  h.bundle('x')
  // nginx -t keeps failing after the restart (exec stub fails for exited containers)
  const r = h.run(DEPLOY, [], { STUB_GW_STATUS: 'exited', BOM_GATEWAY_TIMEOUT: '4', STUB_NO_RESTART: '1' })
  assert.notEqual(r.status, 0)
  assert.ok(!r.has(/^docker stop --time 30 bookofmormon-online-blue$/), 'active slot kept')
  assert.ok(r.has(new RegExp(`^docker rm -f ${GREEN}$`)), 'candidate removed')
})

test('restart attempts from before the bundle arrived do not defeat the reboot fast path', (t) => {
  const h = harness(t)
  h.bundle('x')
  // dockerd retried blue 5 times while /run/bom-secrets was missing; after `docker start`
  // it is "starting" for one poll, then healthy, and RestartCount stays at 5
  const r = h.run(DEPLOY, ['--redeploy-active'], { STUB_RUNNING: '', STUB_RESTARTS: '5', STUB_START_POLLS: '1' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout + r.stderr, new RegExp(`restarted active slot ${BLUE} after runtime config restore`))
  assert.doesNotMatch(r.stdout + r.stderr, /did not recover/)
})
