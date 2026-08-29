#!/bin/sh
set -eu

IMAGE="${BOM_IMAGE:-kckern/bookofmormon-online:prod}"
BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
ENV_FILE="${BOM_ENV_FILE:-$BASE_DIR/.env}"
NETWORK="${BOM_DOCKER_NETWORK:-bomdocker_phpnetwork}"
GATEWAY="${BOM_GATEWAY_CONTAINER:-bookofmormon-online}"
INITIAL_SLOT="${BOM_INITIAL_SLOT:-bookofmormon-online-blue}"
ROLLBACK_SLOT="${BOM_ROLLBACK_SLOT:-bookofmormon-online-green}"
NPM_CONTAINER="${BOM_NPM_CONTAINER:-proxy}"
TEMPLATE="$BASE_DIR/gateway/default.conf.template"
CONFIG="$BASE_DIR/gateway/default.conf"
STATE_FILE="$BASE_DIR/active-slot"
LOCK_FILE="$BASE_DIR/deploy.lock"
HEALTH_TIMEOUT="${BOM_HEALTH_TIMEOUT:-180}"
DRAIN_SECONDS="${BOM_DRAIN_SECONDS:-15}"

log() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

container_running() {
  [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

wait_for_health() {
  container="$1"
  elapsed=0
  while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker container inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)"
    case "$status" in
      healthy) return 0 ;;
      unhealthy)
        docker logs --tail 100 "$container" >&2 || true
        return 1
        ;;
    esac
    sleep 2
    elapsed=$((elapsed + 2))
  done
  docker logs --tail 100 "$container" >&2 || true
  return 1
}

restore_legacy() {
  log "restoring the legacy application route"
  docker rm -f "$GATEWAY" >/dev/null 2>&1 || true
  if docker container inspect "$ROLLBACK_SLOT" >/dev/null 2>&1; then
    docker rename "$ROLLBACK_SLOT" "$GATEWAY"
    docker start "$GATEWAY" >/dev/null 2>&1 || true
    docker exec "$NPM_CONTAINER" nginx -t >/dev/null 2>&1 || true
    docker exec "$NPM_CONTAINER" nginx -s reload >/dev/null 2>&1 || true
  fi
  docker rm -f "$INITIAL_SLOT" >/dev/null 2>&1 || true
}

[ -r "$ENV_FILE" ] || fail "missing environment file: $ENV_FILE"
[ -r "$TEMPLATE" ] || fail "missing gateway template: $TEMPLATE"
[ -r "$BASE_DIR/docker-compose.yml" ] || fail "missing gateway compose file"
[ ! -e "$STATE_FILE" ] || fail "active slot already recorded; use deploy-blue-green.sh"
container_running "$GATEWAY" || fail "legacy application $GATEWAY is not running"
[ "$(docker container inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$GATEWAY")" = "healthy" ] ||
  fail "legacy application $GATEWAY is not healthy"
docker container inspect "$INITIAL_SLOT" >/dev/null 2>&1 && fail "$INITIAL_SLOT already exists"
docker container inspect "$ROLLBACK_SLOT" >/dev/null 2>&1 && fail "$ROLLBACK_SLOT already exists"
container_running "$NPM_CONTAINER" || fail "NPM container $NPM_CONTAINER is not running"

exec 9>"$LOCK_FILE"
flock -n 9 || fail "another deployment is already running"

log "pulling $IMAGE"
docker pull "$IMAGE"

log "starting initial candidate $INITIAL_SLOT"
docker run -d \
  --name "$INITIAL_SLOT" \
  --env-file "$ENV_FILE" \
  --network "$NETWORK" \
  --restart always \
  --label com.centurylinklabs.watchtower.enable=false \
  "$IMAGE" >/dev/null

if ! wait_for_health "$INITIAL_SLOT"; then
  docker rm -f "$INITIAL_SLOT" >/dev/null 2>&1 || true
  fail "initial candidate did not become healthy; legacy route was not touched"
fi
log "initial candidate is healthy"

sed "s/__ACTIVE_SLOT__/$INITIAL_SLOT/g" "$TEMPLATE" > "$CONFIG.next"
mv "$CONFIG.next" "$CONFIG"

# NPM's current workers retain the legacy container IP while it is renamed, so
# the name handoff itself does not interrupt live requests. New workers receive
# the gateway IP only after the gateway and both upstreams have been verified.
log "renaming legacy application to $ROLLBACK_SLOT"
docker rename "$GATEWAY" "$ROLLBACK_SLOT"
trap restore_legacy EXIT
trap 'exit 1' HUP INT TERM

log "starting stable gateway with the original upstream name"
(cd "$BASE_DIR" && docker-compose up -d gateway)
wait_for_health "$GATEWAY" || fail "gateway did not become healthy"
docker exec "$GATEWAY" nginx -t
docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:8200/robots.txt
docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:5005/health

log "reloading NPM onto the verified gateway"
docker exec "$NPM_CONTAINER" nginx -t
docker exec "$NPM_CONTAINER" nginx -s reload
docker exec "$NPM_CONTAINER" curl --fail --silent --show-error --max-time 15 --output /dev/null http://bookofmormon-online:8200/robots.txt
docker exec "$NPM_CONTAINER" curl --fail --silent --show-error --max-time 15 --output /dev/null http://bookofmormon-online:5005/health

printf '%s\n' "$INITIAL_SLOT" > "$STATE_FILE.next"
mv "$STATE_FILE.next" "$STATE_FILE"
trap - EXIT HUP INT TERM
log "gateway cutover complete; draining legacy slot for ${DRAIN_SECONDS}s"
sleep "$DRAIN_SECONDS"
docker stop --time 30 "$ROLLBACK_SLOT" >/dev/null
docker update --restart=no "$ROLLBACK_SLOT" >/dev/null
log "migration complete; $ROLLBACK_SLOT retained as the rollback slot"
