#!/bin/sh
# Publish host and app metrics to CloudWatch (run every 5 min by bom-host-metrics.timer).
#
# No `set -e`: every source is read by its own function, which prints a value or nothing.
# Core metrics (disk, heartbeat, log freshness) go out first in their own call, built in
# memory with no temp file, so a full disk or a broken app container cannot stop them.
# App metrics follow in a second call; any that could not be read are left out.
# DRY_RUN=1 (any value but empty or 0) prints each call's JSON instead of calling aws
# and leaves the state file alone.
set -u

NAMESPACE="${BOM_METRIC_NAMESPACE:-BOM/Production}"
DEFAULT_INSTANCE_ID=""   # no hardcoded id in this public repo; set BOM_INSTANCE_ID or rely on IMDS
BASE_DIR="${BOM_DEPLOY_DIR:-/home/ubuntu/greenfield}"
STATE_DIR="${BOM_METRIC_STATE_DIR:-/var/lib/bom-monitor}"
STATE_FILE="$STATE_DIR/metrics-state.json"
TELEMETRY_FILE="${BOM_TELEMETRY_FILE:-/home/ubuntu/BoMDocker/config/proxy/logs/bom-telemetry.log}"
VECTOR_CONTAINER="${BOM_VECTOR_CONTAINER:-vector}"
WINDOW_SECONDS="${BOM_METRIC_WINDOW_SECONDS:-300}"
VICTORIALOGS_URL="${BOM_VICTORIALOGS_URL:-http://127.0.0.1:9428}"
DRY_RUN="${DRY_RUN:-}"

log() { printf 'bom-publish-host-metrics: %s\n' "$*" >&2; }

# A plain JSON number: digits with an optional fraction, no leading zero (strict JSON parsers,
# including the AWS CLI's, reject "069").
is_number() {
  case "$1" in ''|.*|*.|*.*.*|*[!0-9.]*|0[0-9]*) return 1 ;; esac
}
is_int() {
  case "$1" in ''|*[!0-9]*) return 1 ;; esac
}
is_dry_run() {
  [ -n "$DRY_RUN" ] && [ "$DRY_RUN" != 0 ]
}
is_instance_id() {
  case "$1" in i-|i-*[!0-9a-f]*) return 1 ;; i-*) return 0 ;; *) return 1 ;; esac
}

# --- sources: each prints a value, or nothing on failure -------------------------------

instance_id() {
  if [ -n "${BOM_INSTANCE_ID:-}" ]; then
    if is_instance_id "$BOM_INSTANCE_ID"; then
      printf '%s\n' "$BOM_INSTANCE_ID"
    else
      log "BOM_INSTANCE_ID is not an instance id; using $DEFAULT_INSTANCE_ID"
      printf '%s\n' "$DEFAULT_INSTANCE_ID"
    fi
    return
  fi
  # IMDSv2; falls back to the known id off EC2 or when IMDS does not answer.
  token="$(curl -s --max-time 2 -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
    http://169.254.169.254/latest/api/token 2>/dev/null)"
  id=""
  if [ -n "$token" ]; then
    id="$(curl -s --max-time 2 -H "X-aws-ec2-metadata-token: $token" \
      http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)"
  fi
  if is_instance_id "$id"; then
    printf '%s\n' "$id"
  else
    printf '%s\n' "$DEFAULT_INSTANCE_ID"
  fi
}

disk_used_percent() {
  df -P / 2>/dev/null | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }'
}

# Rows VictoriaLogs ingested in the last 10 minutes; 0 when it cannot be asked, so the
# freshness alarm fires instead of seeing missing data.
victorialogs_recent_rows() {
  n="$(curl -s --max-time 10 "$VICTORIALOGS_URL/select/logsql/query" \
    --data-urlencode 'query=_time:10m | stats count() n' 2>/dev/null | jq -r '.n // 0' 2>/dev/null | head -n 1)"
  if is_number "$n"; then printf '%s\n' "$n"; else printf '0\n'; fi
}

app_container() {
  if [ -s "$BASE_DIR/active-slot" ]; then
    sed -n '1p' "$BASE_DIR/active-slot"
  else
    printf '%s\n' "${BOM_APP_CONTAINER:-bookofmormon-online}"
  fi
}

container_id() {
  timeout 20 docker inspect -f '{{.Id}}' "$1" 2>/dev/null
}

pm2_jlist() {
  timeout 20 docker exec "$1" pm2 jlist 2>/dev/null
}

next_memory_mib() {
  [ -n "$1" ] || return 0
  printf '%s' "$1" | jq '[.[] | select(.name == "next") | .monit.memory / 1048576] | first // 0' 2>/dev/null
}

pm2_restart_total() {
  [ -n "$1" ] || return 0
  printf '%s' "$1" | jq '[.[].pm2_env.restart_time] | add // 0' 2>/dev/null
}

state_field() { # state_field JQ_FILTER DEFAULT
  v=""
  [ -s "$STATE_FILE" ] && v="$(jq -r "$1" "$STATE_FILE" 2>/dev/null)"
  printf '%s\n' "${v:-$2}"
}

vector_healthy() {
  if [ "$(timeout 20 docker inspect -f '{{.State.Running}}' "$VECTOR_CONTAINER" 2>/dev/null || true)" = "true" ] &&
     ! timeout 20 docker logs --since "${WINDOW_SECONDS}s" "$VECTOR_CONTAINER" 2>&1 | grep -Eqi '(^|[^a-z])(error|failed|panic)([^a-z]|$)'; then
    printf '1\n'
  else
    printf '0\n'
  fi
}

# Sets npm_5xx and non_cloudflare: 0 when the log is unreadable (as before). Lines that are
# not JSON (e.g. a half-written last line) are ignored; a missing status counts as 0.
telemetry_counts() {
  npm_5xx=0
  non_cloudflare=0
  [ -r "$TELEMETRY_FILE" ] || return 0
  npm_5xx=""
  non_cloudflare=""
  cutoff="$(date -u -d "$WINDOW_SECONDS seconds ago" '+%Y-%m-%dT%H:%M:%S+00:00' 2>/dev/null)" || return 0
  [ -n "$cutoff" ] || return 0
  telemetry_window="$(tail -n 50000 "$TELEMETRY_FILE" | jq -cR --arg cutoff "$cutoff" 'fromjson? | objects | select(.timestamp >= $cutoff)')" || return 0
  npm_5xx="$(printf '%s\n' "$telemetry_window" | jq -s '[.[] | select(((.status | tonumber?) // 0) >= 500)] | length' 2>/dev/null)"
  # Expected ingress: Cloudflare (via the cloudflared tunnel) and CloudFront (the
  # Korean hostname and the Route 53-hosted products). Anything else reached the
  # origin directly.
  non_cloudflare="$(printf '%s\n' "$telemetry_window" | jq -s '[.[] | select(.ingress != "cloudflare" and .ingress != "tunnel" and .ingress != "cloudfront")] | length' 2>/dev/null)"
}

# --- publishing --------------------------------------------------------------------------

batch=""
add() { # add NAME UNIT VALUE: append a MetricDatum to $batch, or skip it if VALUE is not a number
  if ! is_number "$3"; then
    log "skipping $1: no value"
    return 0
  fi
  datum="$(printf '{"MetricName":"%s","Dimensions":[{"Name":"InstanceId","Value":"%s"}],"Timestamp":"%s","Unit":"%s","Value":%s}' \
    "$1" "$INSTANCE_ID" "$now" "$2" "$3")"
  batch="${batch:+$batch,}$datum"
}

publish() { # publish: send $batch in one put-metric-data call (no temp file), then empty it
  json="[$batch]"
  batch=""
  [ "$json" != "[]" ] || return 0
  if is_dry_run; then
    printf '%s\n' "$json"
    return 0
  fi
  aws cloudwatch put-metric-data --region us-west-2 --namespace "$NAMESPACE" --metric-data "$json" \
    --cli-connect-timeout 10 --cli-read-timeout 20
}

status=0
now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
INSTANCE_ID="$(instance_id)"
if ! is_instance_id "$INSTANCE_ID"; then
  log "no instance id (set BOM_INSTANCE_ID or run on EC2)"
  exit 1
fi

# Core: must arrive every run, whatever else is broken.
disk_used="$(disk_used_percent)"
log_rows="$(victorialogs_recent_rows)"
add RootDiskUsedPercent Percent "$disk_used"
add HostMetricsHeartbeat Count 1
add VictoriaLogsRecentRows Count "$log_rows"
if ! publish; then
  log "core put-metric-data failed"
  status=1
fi

# App: pm2, telemetry, Vector.
mkdir -p "$STATE_DIR" 2>/dev/null
APP_CONTAINER="$(app_container)"
container_id="$(container_id "$APP_CONTAINER")"
pm2="$(pm2_jlist "$APP_CONTAINER")"
[ -n "$pm2" ] || log "pm2 jlist in $APP_CONTAINER failed"
next_memory="$(next_memory_mib "$pm2")"
restart_total="$(pm2_restart_total "$pm2")"

previous_container="$(state_field '.containerId // ""' "")"
previous_restarts="$(state_field '.restartTotal // 0' 0)"
previous_log_bytes="$(state_field '.telemetryBytes // 0' 0)"
is_int "$previous_restarts" || previous_restarts=0
is_int "$previous_log_bytes" || previous_log_bytes=0

# Without a container id and restart count there is no delta; keep the old baseline.
restart_delta=""
state_container="$previous_container"
state_restarts="$previous_restarts"
if [ -n "$container_id" ] && is_int "$restart_total"; then
  restart_delta=0
  if [ "$container_id" = "$previous_container" ] && [ "$restart_total" -ge "$previous_restarts" ]; then
    restart_delta=$((restart_total - previous_restarts))
  fi
  state_container="$container_id"
  state_restarts="$restart_total"
fi

telemetry_bytes="$(stat -c '%s' "$TELEMETRY_FILE" 2>/dev/null || printf '0')"
is_int "$telemetry_bytes" || telemetry_bytes=0
telemetry_growth=0
if [ "$telemetry_bytes" -ge "$previous_log_bytes" ]; then
  telemetry_growth=$((telemetry_bytes - previous_log_bytes))
fi

vector="$(vector_healthy)"
telemetry_counts

add NextMemoryMiB Megabytes "$next_memory"
add PM2RestartDelta Count "$restart_delta"
add NPM5xxCount Count "$npm_5xx"
add VectorHealthy Count "$vector"
add NonCloudflareIngressCount Count "$non_cloudflare"
add TelemetryLogBytes Bytes "$telemetry_bytes"
add TelemetryGrowthBytes Bytes "$telemetry_growth"
if publish; then
  if ! is_dry_run; then
    state_next="$STATE_FILE.next"
    if jq -n \
      --arg containerId "$state_container" \
      --argjson restartTotal "$state_restarts" \
      --argjson telemetryBytes "$telemetry_bytes" \
      --arg updatedAt "$now" \
      '{containerId:$containerId,restartTotal:$restartTotal,telemetryBytes:$telemetryBytes,updatedAt:$updatedAt}' > "$state_next"; then
      mv "$state_next" "$STATE_FILE"
    else
      rm -f "$state_next"
      log "could not write $STATE_FILE"
    fi
  fi
else
  log "app put-metric-data failed"
  status=1
fi

printf '%s\n' "published: next=${next_memory:--}MiB restarts=${restart_delta:--} 5xx=${npm_5xx:--} vector=${vector} non_cf=${non_cloudflare:--} disk=${disk_used:--}% logs10m=${log_rows} telemetry=${telemetry_bytes}B growth=${telemetry_growth}B"
exit "$status"
