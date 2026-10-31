#!/bin/sh
# Container entrypoint: load runtime config from RAM-backed files, then exec the command.
# One file per variable: file name = variable name, content = value. Values are never printed.
# Mounted by ops/production/deploy-blue-green.sh from the host's /run/bom-secrets (tmpfs).
# Also usable for one-off jobs: docker exec <ctr> /app/ops/container/entrypoint.sh node script.mjs
set -eu
dir="${BOM_SECRETS_DIR:-/run/secrets}"
# Captured before loading so files cannot change the script's own control; BOM_* files are skipped.
require="${BOM_REQUIRE_SECRETS:-0}"
if [ -d "$dir" ]; then
  for f in "$dir"/*; do
    [ -f "$f" ] || continue
    name="${f##*/}"
    case "$name" in
      ''|[0-9]*|*[!A-Za-z0-9_]*|BOM_*) echo "entrypoint: skipping invalid variable name '$name' in $dir" >&2; continue ;;
    esac
    value="$(cat "$f")" || { echo "entrypoint: cannot read $name in $dir" >&2; exit 78; }
    export "$name=$value"
  done
fi
if [ "$require" = 1 ] && [ -z "${MYSQL_PASSWORD:-}" ]; then
  echo "entrypoint: runtime config missing in $dir (MYSQL_PASSWORD unset); refusing to start" >&2
  exit 78
fi
exec "$@"
