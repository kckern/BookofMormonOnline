#!/usr/bin/env bash
# Read-only prod soak summary. Run via:
#   scripts/with-prod-secrets.sh ssh -- scripts/home-audit/prod-soak.sh [hours]
# Reads NPM telemetry and the active container's logs; changes nothing.
set -euo pipefail
H="${1:-24}"
SSH=(ssh -i "$PROD_KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "ubuntu@$PROD_HOST")
echo "== NPM telemetry: request/status histogram and top 5xx (uri, render_mode)"
"${SSH[@]}" "docker exec proxy cat /data/logs/bom-telemetry.log" | jq -rs '
  map(select(type=="object")) as $all
  | {requests: ($all|length),
     by_status: ($all | group_by(.status) | map({key: (.[0].status|tostring), value: length}) | from_entries),
     fivexx_top: ($all | map(select((.status|tonumber) >= 500)) | group_by([.status,.uri,.render_mode]) | map({k: (.[0]|[.status,.uri,.render_mode]), n: length}) | sort_by(-.n) | .[0:10])}' \
  || echo "(telemetry shape differs — inspect one raw line, adjust field names)"
echo "== active container error lines (last ${H}h), ids collapsed"
"${SSH[@]}" 'A=$(sed -n 1p /home/ubuntu/greenfield/active-slot); docker logs --since '"${H}"'h "$A" 2>&1 | grep -E -i "error|ECONNREFUSED|unhandled|fatal" | sed -E "s/[0-9a-f]{8}-[0-9a-f-]{27}/<id>/g" | sort | uniq -c | sort -rn | head -15'
echo "== containers"
"${SSH[@]}" 'docker ps --format "{{.Names}} {{.Status}}" | grep -E "bookofmormon-online|proxy"'
