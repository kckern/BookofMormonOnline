#!/bin/sh
set -eu

IMAGE="${BOM_IMAGE:-kckern/bookofmormon-online:prod}"
BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
ENV_FILE="${BOM_ENV_FILE:-$BASE_DIR/.env}"
NETWORK="${BOM_DOCKER_NETWORK:-bomdocker_phpnetwork}"
GATEWAY="${BOM_GATEWAY_CONTAINER:-bookofmormon-online}"
GATEWAY_IMAGE="${BOM_GATEWAY_IMAGE:-nginx:stable-alpine}"
GATEWAY_DIR="$BASE_DIR/gateway"
TEMPLATE="$GATEWAY_DIR/default.conf.template"
CONFIG="$GATEWAY_DIR/default.conf"
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

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

render_gateway_config() {
  slot="$1"
  tmp="$CONFIG.next"
  sed "s/__ACTIVE_SLOT__/$slot/g" "$TEMPLATE" > "$tmp"
  mv "$tmp" "$CONFIG"
}

wait_for_health() {
  container="$1"
  elapsed=0
  while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker container inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container" 2>/dev/null || true)"
    case "$status" in
      healthy)
        return 0
        ;;
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

verify_gateway() {
  docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:8200/robots.txt
  docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:5005/health
}

mkdir -p "$BASE_DIR" "$GATEWAY_DIR"
[ -r "$ENV_FILE" ] || fail "missing environment file: $ENV_FILE"
[ -r "$TEMPLATE" ] || fail "missing gateway template: $TEMPLATE"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "another deployment is already running"
  exit 0
fi

active=""
if [ -s "$STATE_FILE" ]; then
  active="$(sed -n '1p' "$STATE_FILE")"
fi

case "$active" in
  bookofmormon-online-blue) next="bookofmormon-online-green" ;;
  bookofmormon-online-green) next="bookofmormon-online-blue" ;;
  *) fail "missing or invalid active slot; run migrate-blue-green.sh first" ;;
esac

# A retained rollback slot must stay down across Docker daemon and host
# restarts. Normalize older slots before a no-op exit and after every drain.
if container_exists "$next"; then
  if container_running "$next"; then
    log "stopping unexpectedly running inactive slot $next"
    docker stop --time 30 "$next" >/dev/null
  fi
  docker update --restart=no "$next" >/dev/null
fi

log "pulling $IMAGE"
docker pull "$IMAGE"
desired_image="$(docker image inspect -f '{{.Id}}' "$IMAGE")"

if [ -n "$active" ] && container_running "$active"; then
  active_image="$(docker container inspect -f '{{.Image}}' "$active")"
  active_health="$(docker container inspect -f '{{.State.Health.Status}}' "$active" 2>/dev/null || true)"
  if [ "$active_image" = "$desired_image" ] && [ "$active_health" = "healthy" ]; then
    log "$active already runs the desired healthy image"
    exit 0
  fi
fi

if container_exists "$next"; then
  log "removing inactive slot $next"
  docker rm -f "$next" >/dev/null
fi

log "starting candidate $next"
docker run -d \
  --name "$next" \
  --env-file "$ENV_FILE" \
  --network "$NETWORK" \
  --restart always \
  --label com.centurylinklabs.watchtower.enable=false \
  "$IMAGE" >/dev/null

if ! wait_for_health "$next"; then
  docker rm -f "$next" >/dev/null 2>&1 || true
  fail "candidate $next did not become healthy; active slot was not changed"
fi
log "candidate $next is healthy"

render_gateway_config "$next"

gateway_created=0
if container_exists "$GATEWAY"; then
  if ! container_running "$GATEWAY"; then
    docker start "$GATEWAY" >/dev/null
  fi
  if ! docker exec "$GATEWAY" nginx -t || ! docker exec "$GATEWAY" nginx -s reload; then
    render_gateway_config "$active"
    docker exec "$GATEWAY" nginx -t >/dev/null 2>&1 || true
    docker exec "$GATEWAY" nginx -s reload >/dev/null 2>&1 || true
    docker rm -f "$next" >/dev/null 2>&1 || true
    fail "gateway rejected candidate config; restored $active"
  fi
else
  log "starting stable gateway $GATEWAY"
  docker run -d \
    --name "$GATEWAY" \
    --network "$NETWORK" \
    --restart always \
    --label com.centurylinklabs.watchtower.enable=false \
    --health-cmd 'wget -q -T 10 -O /dev/null http://127.0.0.1:8200/robots.txt && wget -q -T 10 -O /dev/null http://127.0.0.1:5005/health' \
    --health-interval 15s \
    --health-timeout 12s \
    --health-retries 3 \
    --health-start-period 30s \
    -v "$GATEWAY_DIR:/etc/nginx/conf.d:ro" \
    "$GATEWAY_IMAGE" >/dev/null
  gateway_created=1
fi

if ! verify_gateway; then
  if [ "$gateway_created" -eq 1 ]; then
    docker rm -f "$GATEWAY" >/dev/null 2>&1 || true
  else
    render_gateway_config "$active"
    docker exec "$GATEWAY" nginx -t >/dev/null 2>&1 || true
    docker exec "$GATEWAY" nginx -s reload >/dev/null 2>&1 || true
  fi
  docker rm -f "$next" >/dev/null 2>&1 || true
  fail "gateway verification failed; restored $active"
fi

tmp_state="$STATE_FILE.next"
printf '%s\n' "$next" > "$tmp_state"
mv "$tmp_state" "$STATE_FILE"
log "gateway switched to $next"

if [ -n "$active" ] && [ "$active" != "$next" ] && container_running "$active"; then
  log "draining $active for ${DRAIN_SECONDS}s"
  sleep "$DRAIN_SECONDS"
  docker stop --time 30 "$active" >/dev/null
  docker update --restart=no "$active" >/dev/null
  log "stopped previous slot $active (retained for rollback until the next deployment)"
fi

docker image prune -f --filter 'until=168h' >/dev/null 2>&1 || true
log "deployment complete"
