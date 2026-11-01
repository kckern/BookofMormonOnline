#!/bin/sh
set -eu

BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
GATEWAY="${BOM_GATEWAY_CONTAINER:-bookofmormon-online}"
TEMPLATE="$BASE_DIR/gateway/default.conf.template"
CONFIG="$BASE_DIR/gateway/default.conf"
STATE_FILE="$BASE_DIR/active-slot"
GATEWAY_TIMEOUT="${BOM_GATEWAY_TIMEOUT:-60}"

# Same gateway handling as deploy-blue-green.sh (duplicated on purpose: SSM ships
# only the deploy script, which must stay self-contained). A gateway that is not
# "running" (Running stays true while "restarting") can't be exec'd into, so it is
# restarted on the rendered config and polled until nginx -t passes.
gateway_status() {
  docker container inspect -f '{{.State.Status}}' "$GATEWAY" 2>/dev/null || true
}

apply_gateway_config() {
  if [ "$(gateway_status)" = running ] \
    && docker exec "$GATEWAY" nginx -t && docker exec "$GATEWAY" nginx -s reload; then
    return 0
  fi
  echo "gateway $GATEWAY is $(gateway_status) or rejected the reload; restarting it on the rendered config" >&2
  docker restart "$GATEWAY" >/dev/null || return 1
  gw_elapsed=0
  while [ "$gw_elapsed" -lt "$GATEWAY_TIMEOUT" ]; do
    if [ "$(gateway_status)" = running ] && docker exec "$GATEWAY" nginx -t >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    gw_elapsed=$((gw_elapsed + 2))
  done
  echo "gateway $GATEWAY did not come up within ${GATEWAY_TIMEOUT}s" >&2
  return 1
}

render_gateway_config() {
  sed "s/__ACTIVE_SLOT__/$1/g" "$TEMPLATE" > "$CONFIG.next"
  mv "$CONFIG.next" "$CONFIG"
}

[ -s "$STATE_FILE" ] || { echo "No active slot is recorded" >&2; exit 1; }
active="$(sed -n '1p' "$STATE_FILE")"
case "$active" in
  bookofmormon-online-blue) previous="bookofmormon-online-green" ;;
  bookofmormon-online-green) previous="bookofmormon-online-blue" ;;
  *) echo "Invalid active slot: $active" >&2; exit 1 ;;
esac

docker container inspect "$previous" >/dev/null 2>&1 || { echo "Rollback slot $previous does not exist" >&2; exit 1; }
# Slots created from the RAM bundle bind-mount it at /run/secrets; docker start
# re-binds the host path, which is empty after a reboot until homeserver re-pushes.
# Older env-file slots have no such mount and need nothing here.
secrets_src="$(docker container inspect -f '{{range .Mounts}}{{if eq .Destination "/run/secrets"}}{{.Source}}{{end}}{{end}}' "$previous")"
if [ -n "$secrets_src" ] && ! [ -s "$secrets_src/MYSQL_PASSWORD" ]; then
  echo "runtime config not present in $secrets_src; run scripts/bom-secrets-push.sh push on homeserver before rolling back" >&2
  exit 1
fi
docker update --restart=always "$previous" >/dev/null
docker start "$previous" >/dev/null

elapsed=0
while [ "$elapsed" -lt 180 ]; do
  status="$(docker container inspect -f '{{.State.Health.Status}}' "$previous" 2>/dev/null || true)"
  [ "$status" = "healthy" ] && break
  [ "$status" = "unhealthy" ] && { docker logs --tail 100 "$previous" >&2; exit 1; }
  sleep 2
  elapsed=$((elapsed + 2))
done
[ "$(docker container inspect -f '{{.State.Health.Status}}' "$previous")" = "healthy" ] || exit 1

# The state file is written only after the gateway serves $previous; on failure
# the config goes back to $active so state and gateway never disagree.
render_gateway_config "$previous"
if ! apply_gateway_config \
  || ! docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:8200/robots.txt \
  || ! docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:5005/health; then
  render_gateway_config "$active"
  apply_gateway_config >/dev/null || true
  docker stop --time 30 "$previous" >/dev/null 2>&1 || true
  docker update --restart=no "$previous" >/dev/null 2>&1 || true
  echo "gateway did not accept $previous; restored $active and stopped $previous again" >&2
  exit 1
fi
printf '%s\n' "$previous" > "$STATE_FILE.next"
mv "$STATE_FILE.next" "$STATE_FILE"
sleep "${BOM_DRAIN_SECONDS:-15}"
docker stop --time 30 "$active" >/dev/null
docker update --restart=no "$active" >/dev/null
echo "Rolled back from $active to $previous"
