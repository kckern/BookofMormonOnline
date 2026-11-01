import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
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
  // one `sh -n` per file: extra operands would only become positional args of the first
  for (const file of [
    'deploy-blue-green.sh',
    'migrate-blue-green.sh',
    'rollback-blue-green.sh',
    'publish-host-metrics.sh',
    'secrets-receive.sh',
  ]) execFileSync('sh', ['-n', resolve(root, file)])
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

const workflowsDir = resolve(root, '..', '..', '.github', 'workflows')
const readWorkflow = (wf) => readFileSync(resolve(workflowsDir, wf), 'utf8')
const ingestWorkflows = ['ingest-korean-bot-avatars.yml', 'ingest-french-bot-avatars.yml', 'ingest-group-covers.yml']

test('one-off docker exec jobs load runtime config through the entrypoint', () => {
  let checked = 0
  for (const wf of readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    for (const line of readWorkflow(wf).split('\n').filter((l) => /docker exec .*\bnode\b/.test(l))) {
      assert.match(line, /ACTIVE\\?"\s+\/app\/ops\/container\/entrypoint\.sh node\b/, `${wf}: ${line.trim()}`)
      checked++
    }
  }
  assert.ok(checked >= 3, `expected at least 3 docker exec … node lines, found ${checked}`)
})

test('ingest jobs fail clearly when the active slot predates the entrypoint', () => {
  for (const wf of ingestWorkflows) {
    assert.match(readWorkflow(wf), /docker exec "\$ACTIVE" test -x \/app\/ops\/container\/entrypoint\.sh \|\| \{ echo "[^"]*predates the runtime-secrets entrypoint[^"]*" >&2; exit 1; \}/, wf)
  }
})

test('deployment never reads a secret store or writes env files', () => {
  assert.ok(!deployment.includes('secretsmanager'), 'no Secrets Manager calls')
  assert.ok(!deployment.includes('--env-file'), 'no env files')
  assert.ok(!/ENV_FILE/.test(deployment), 'no ENV_FILE / MAIL_ENV_FILE paths')
  assert.ok(!/>\s*"\$ENV_FILE"/.test(deployment), 'no rendered .env')
})

test('candidate mounts the tmpfs bundle read-only and requires it', () => {
  assert.match(deployment, /SECRETS_DIR="\$\{BOM_SECRETS_DIR:-\/run\/bom-secrets\}"/)
  assert.match(deployment, /--mount "type=bind,src=\$SECRETS_DIR,dst=\/run\/secrets,readonly"/)
  assert.match(deployment, /-e BOM_REQUIRE_SECRETS=1/)
  assert.match(deployment, /\[ -s "\$SECRETS_DIR\/MYSQL_PASSWORD" \]/)
})

test('missing RAM bundle fails before the active slot is touched', () => {
  // the CALL (a bare line), not the definition `require_runtime_bundle() {`
  const call = deployment.search(/^require_runtime_bundle$/m)
  assert.notEqual(call, -1, 'require_runtime_bundle is called')
  const def = deployment.indexOf('require_runtime_bundle() {')
  assert.ok(def !== -1 && def < call, 'defined before it is called')
  assert.ok(deployment.indexOf('fail() {') < call, 'fail is defined before the call')
  const before = (needle) => {
    const at = deployment.indexOf(needle)
    assert.notEqual(at, -1, `missing ${JSON.stringify(needle)}`)
    assert.ok(call < at, `require_runtime_bundle must run before ${JSON.stringify(needle)}`)
  }
  before('removing inactive slot $next') // the retained rollback slot survives a missing bundle
  before('docker run -d') // first docker run -d is the candidate
  before('render_gateway_config "$next"')
  before('docker stop --time 30 "$active"')
})

test('--redeploy-active redeploys the running image even when healthy', () => {
  assert.match(deployment, /^\s+--redeploy-active\) REDEPLOY_ACTIVE=1 ;;$/m)
  ordered(
    deployment,
    'IMAGE="$(docker container inspect -f \'{{.Config.Image}}\' "$active")',
    'docker pull "$IMAGE"',
    'verify_signature "$IMAGE"',
    'if [ "$REDEPLOY_ACTIVE" = 0 ] && [ "$active_image" = "$desired_image" ]',
    'already runs the desired healthy image',
  )
})

const shellFunction = (source, name) => {
  const start = source.indexOf(`${name}() {`)
  assert.notEqual(start, -1, `missing function ${name}`)
  const end = source.indexOf('\n}\n', start)
  assert.notEqual(end, -1, `unterminated function ${name}`)
  return source.slice(start, end)
}

test('emergency prune never removes the rollback slot without a runtime bundle', () => {
  const body = shellFunction(deployment, 'emergency_prune_if_needed')
  const call = body.search(/^\s+require_runtime_bundle$/m)
  assert.notEqual(call, -1, 'emergency prune calls require_runtime_bundle')
  const rm = body.indexOf('docker rm "$next"')
  assert.notEqual(rm, -1)
  assert.ok(call < rm, 'require_runtime_bundle precedes docker rm "$next"')
  assert.ok(call < body.indexOf('removing inactive rollback slot $next'))
})

test('redeploy mode requires the bundle and a digest-pinned image before prune or pull', () => {
  const start = deployment.indexOf('if [ "$REDEPLOY_ACTIVE" = 1 ]; then\n  require_runtime_bundle')
  assert.notEqual(start, -1)
  const block = deployment.slice(start, deployment.indexOf('\nfi\n', start))
  assert.match(block, /^\s+require_runtime_bundle$/m)
  assert.match(block, /case "\$IMAGE" in\s+\*@sha256:\*\) ;;\s+\*\) fail "active slot image is not pinned by digest \(\$IMAGE\); deploy via CI instead" ;;\s+esac/)
  assert.ok(block.indexOf('IMAGE="$(docker container inspect') < block.indexOf('case "$IMAGE" in'))
  for (const later of ['emergency_prune_if_needed\n', 'docker image prune -f', 'docker pull "$IMAGE"']) {
    const at = deployment.indexOf(later)
    assert.ok(start < at, `redeploy checks precede ${JSON.stringify(later)}`)
  }
  assert.ok(deployment.indexOf('docker pull "$IMAGE"') > start + block.length)
})
