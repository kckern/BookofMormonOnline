#!/bin/sh
set -eu

NAMESPACE="${BOM_METRIC_NAMESPACE:-BOM/Production}"
INSTANCE_ID="${BOM_INSTANCE_ID:-i-02c9619a48343a8d9}"
BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
STATE_DIR="${BOM_METRIC_STATE_DIR:-/var/lib/bom-monitor}"
STATE_FILE="$STATE_DIR/metrics-state.json"
TELEMETRY_FILE="${BOM_TELEMETRY_FILE:-/home/ubuntu/BoMDocker/config/proxy/logs/bom-telemetry.log}"
VECTOR_CONTAINER="${BOM_VECTOR_CONTAINER:-vector}"
WINDOW_SECONDS="${BOM_METRIC_WINDOW_SECONDS:-300}"

mkdir -p "$STATE_DIR"

if [ -s "$BASE_DIR/active-slot" ]; then
  APP_CONTAINER="$(sed -n '1p' "$BASE_DIR/active-slot")"
else
  APP_CONTAINER="${BOM_APP_CONTAINER:-bookofmormon-online}"
fi

now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
cutoff="$(date -u -d "$WINDOW_SECONDS seconds ago" '+%Y-%m-%dT%H:%M:%S+00:00')"
container_id="$(docker inspect -f '{{.Id}}' "$APP_CONTAINER")"
pm2="$(docker exec "$APP_CONTAINER" pm2 jlist)"
next_memory="$(printf '%s' "$pm2" | jq '[.[] | select(.name == "next") | .monit.memory / 1048576] | first // 0')"
restart_total="$(printf '%s' "$pm2" | jq '[.[].pm2_env.restart_time] | add // 0')"

previous_container=""
previous_restarts=0
previous_log_bytes=0
if [ -s "$STATE_FILE" ]; then
  previous_container="$(jq -r '.containerId // ""' "$STATE_FILE")"
  previous_restarts="$(jq -r '.restartTotal // 0' "$STATE_FILE")"
  previous_log_bytes="$(jq -r '.telemetryBytes // 0' "$STATE_FILE")"
fi

restart_delta=0
if [ "$container_id" = "$previous_container" ] && [ "$restart_total" -ge "$previous_restarts" ]; then
  restart_delta=$((restart_total - previous_restarts))
fi

telemetry_bytes="$(stat -c '%s' "$TELEMETRY_FILE" 2>/dev/null || printf '0')"
telemetry_growth=0
if [ "$telemetry_bytes" -ge "$previous_log_bytes" ]; then
  telemetry_growth=$((telemetry_bytes - previous_log_bytes))
fi

disk_used="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
vector_healthy=0
if [ "$(docker inspect -f '{{.State.Running}}' "$VECTOR_CONTAINER" 2>/dev/null || true)" = "true" ] &&
   ! docker logs --since "${WINDOW_SECONDS}s" "$VECTOR_CONTAINER" 2>&1 | grep -Eqi '(^|[^a-z])(error|failed|panic)([^a-z]|$)'; then
  vector_healthy=1
fi

npm_5xx=0
non_cloudflare=0
if [ -r "$TELEMETRY_FILE" ]; then
  telemetry_window="$(tail -n 50000 "$TELEMETRY_FILE" | jq -c --arg cutoff "$cutoff" 'select(.timestamp >= $cutoff)')"
  npm_5xx="$(printf '%s\n' "$telemetry_window" | jq -s '[.[] | select((.status | tonumber) >= 500)] | length')"
  # The Korean hostname legitimately bypasses Cloudflare until its parent
  # delegation moves from Route 53. Remove that exception after activation.
  non_cloudflare="$(printf '%s\n' "$telemetry_window" | jq -s '[.[] | select(.ingress != "cloudflare" and .host != "xn--289a67xla.kr")] | length')"
fi

metrics_file="$(mktemp)"
trap 'rm -f "$metrics_file"' EXIT
jq -n \
  --arg instance "$INSTANCE_ID" \
  --arg timestamp "$now" \
  --argjson nextMemory "$next_memory" \
  --argjson restartDelta "$restart_delta" \
  --argjson npm5xx "$npm_5xx" \
  --argjson vectorHealthy "$vector_healthy" \
  --argjson nonCloudflare "$non_cloudflare" \
  --argjson diskUsed "$disk_used" \
  --argjson telemetryBytes "$telemetry_bytes" \
  --argjson telemetryGrowth "$telemetry_growth" \
  '[
    {MetricName:"NextMemoryMiB", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Megabytes", Value:$nextMemory},
    {MetricName:"PM2RestartDelta", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Count", Value:$restartDelta},
    {MetricName:"NPM5xxCount", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Count", Value:$npm5xx},
    {MetricName:"VectorHealthy", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Count", Value:$vectorHealthy},
    {MetricName:"NonCloudflareIngressCount", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Count", Value:$nonCloudflare},
    {MetricName:"RootDiskUsedPercent", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Percent", Value:$diskUsed},
    {MetricName:"TelemetryLogBytes", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Bytes", Value:$telemetryBytes},
    {MetricName:"TelemetryGrowthBytes", Dimensions:[{Name:"InstanceId",Value:$instance}], Timestamp:$timestamp, Unit:"Bytes", Value:$telemetryGrowth}
  ]' > "$metrics_file"

aws cloudwatch put-metric-data --region us-west-2 --namespace "$NAMESPACE" --metric-data "file://$metrics_file"

state_next="$STATE_FILE.next"
jq -n \
  --arg containerId "$container_id" \
  --argjson restartTotal "$restart_total" \
  --argjson telemetryBytes "$telemetry_bytes" \
  --arg updatedAt "$now" \
  '{containerId:$containerId,restartTotal:$restartTotal,telemetryBytes:$telemetryBytes,updatedAt:$updatedAt}' > "$state_next"
mv "$state_next" "$STATE_FILE"

printf '%s\n' "published: next=${next_memory}MiB restarts=${restart_delta} 5xx=${npm_5xx} vector=${vector_healthy} non_cf=${non_cloudflare} disk=${disk_used}% telemetry=${telemetry_bytes}B growth=${telemetry_growth}B"
