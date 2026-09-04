import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const read = (name) => readFileSync(resolve(root, name), 'utf8')

const migration = read('migrate-blue-green.sh')
const deployment = read('deploy-blue-green.sh')
const rollback = read('rollback-blue-green.sh')
const compose = read('docker-compose.yml')

function ordered(source, ...needles) {
  let cursor = -1
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1)
    assert.notEqual(next, -1, `missing ${JSON.stringify(needle)}`)
    assert.ok(next > cursor, `${JSON.stringify(needle)} is out of order`)
    cursor = next
  }
}

test('all deployment shell entrypoints parse as POSIX shell', () => {
  execFileSync('sh', [
    '-n',
    resolve(root, 'deploy-blue-green.sh'),
    resolve(root, 'migrate-blue-green.sh'),
    resolve(root, 'rollback-blue-green.sh'),
    resolve(root, 'publish-host-metrics.sh'),
  ])
})

test('initial migration health-gates before changing the live Docker name', () => {
  ordered(
    migration,
    'docker run -d',
    'wait_for_health "$INITIAL_SLOT"',
    'docker rename "$GATEWAY" "$ROLLBACK_SLOT"',
    'docker-compose up -d gateway',
    'wait_for_health "$GATEWAY"',
    'docker exec "$NPM_CONTAINER" nginx -s reload',
    'mv "$STATE_FILE.next" "$STATE_FILE"',
    'docker stop --time 30 "$ROLLBACK_SLOT"',
  )
})

test('initial migration installs rollback before gateway or NPM mutations', () => {
  ordered(
    migration,
    'docker rename "$GATEWAY" "$ROLLBACK_SLOT"',
    'trap restore_legacy EXIT',
    'docker-compose up -d gateway',
    'docker exec "$NPM_CONTAINER" nginx -s reload',
  )
  assert.match(migration, /restore_legacy\(\)[\s\S]*docker rename "\$ROLLBACK_SLOT" "\$GATEWAY"/)
  assert.match(migration, /restore_legacy\(\)[\s\S]*docker exec "\$NPM_CONTAINER" nginx -s reload/)
})

test('the stable gateway owns the exact legacy upstream name without an alias collision', () => {
  for (const source of [migration, deployment, rollback]) {
    assert.match(source, /BOM_GATEWAY_CONTAINER:-bookofmormon-online/)
    assert.doesNotMatch(source, /network-alias/)
  }
  assert.match(compose, /container_name:\s*bookofmormon-online/)
  assert.match(compose, /com\.centurylinklabs\.watchtower\.enable:\s*"false"/)
})

test('routine deployment restores the active upstream on reload or verification failure', () => {
  assert.match(deployment, /gateway rejected candidate config; restored \$active/)
  assert.match(deployment, /gateway verification failed; restored \$active/)
  assert.match(deployment, /missing or invalid active slot; run migrate-blue-green\.sh first/)
})

test('inactive and rollback slots cannot restart alongside the active slot', () => {
  assert.match(migration, /docker update --restart=no "\$ROLLBACK_SLOT"/)
  assert.match(deployment, /docker update --restart=no "\$next"/)
  assert.match(deployment, /docker update --restart=no "\$active"/)
  assert.match(rollback, /docker update --restart=always "\$previous"/)
  assert.match(rollback, /docker update --restart=no "\$active"/)
})

test('90 percent disk pressure sacrifices only the inactive rollback slot before an aggressive prune', () => {
  assert.match(deployment, /BOM_EMERGENCY_DISK_PERCENT:-90/)
  ordered(
    deployment,
    'disk_used_percent() {',
    'emergency_prune_if_needed() {',
    'removing inactive rollback slot $next',
    'docker rm "$next"',
    'docker system prune -a -f',
    'refusing image pull',
    'docker pull "$IMAGE"',
  )
  assert.doesNotMatch(deployment, /docker (system|volume) prune[^\n]*--volumes/)
})
