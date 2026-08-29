#!/bin/sh
set -eu

BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
GATEWAY="${BOM_GATEWAY_CONTAINER:-bookofmormon-gateway}"
TEMPLATE="$BASE_DIR/gateway/default.conf.template"
CONFIG="$BASE_DIR/gateway/default.conf"
STATE_FILE="$BASE_DIR/active-slot"

[ -s "$STATE_FILE" ] || { echo "No active slot is recorded" >&2; exit 1; }
active="$(sed -n '1p' "$STATE_FILE")"
case "$active" in
  bookofmormon-online-blue) previous="bookofmormon-online-green" ;;
  bookofmormon-online-green) previous="bookofmormon-online-blue" ;;
  *) echo "Invalid active slot: $active" >&2; exit 1 ;;
esac

docker container inspect "$previous" >/dev/null 2>&1 || { echo "Rollback slot $previous does not exist" >&2; exit 1; }
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

sed "s/__ACTIVE_SLOT__/$previous/g" "$TEMPLATE" > "$CONFIG.next"
mv "$CONFIG.next" "$CONFIG"
docker exec "$GATEWAY" nginx -t
docker exec "$GATEWAY" nginx -s reload
docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:8200/robots.txt
docker exec "$GATEWAY" wget -q -T 15 -O /dev/null http://127.0.0.1:5005/health
printf '%s\n' "$previous" > "$STATE_FILE.next"
mv "$STATE_FILE.next" "$STATE_FILE"
sleep "${BOM_DRAIN_SECONDS:-15}"
docker stop --time 30 "$active" >/dev/null
echo "Rolled back from $active to $previous"
