#!/bin/sh
# Forced-command endpoint for homeserver's push key (installed as /usr/local/sbin/bom-secrets-receive).
# Commands (via SSH_ORIGINAL_COMMAND): status | put | redeploy. Never prints values.
# put reads lines "NAME<TAB>base64(value)" on stdin and atomically replaces $BOM_SECRETS_ROOT.
set -eu
ROOT="${BOM_SECRETS_ROOT:-/run/bom-secrets}"
PARENT="$(dirname "$ROOT")"
TAB="$(printf '\t')"
umask 077
case "${SSH_ORIGINAL_COMMAND:-}" in
  status)
    n=0; [ -d "$ROOT" ] && n=$(find "$ROOT" -maxdepth 1 -type f | wc -l)
    echo "files=$((n + 0))" ;;
  put)
    if [ "${BOM_SECRETS_SKIP_TMPFS_CHECK:-0}" != 1 ] && [ "$(findmnt -no FSTYPE --target "$PARENT")" != tmpfs ]; then
      echo "refusing: $PARENT is not tmpfs" >&2; exit 1
    fi
    new="$ROOT.new.$$"; rm -rf "$new"; mkdir -m 700 "$new"
    count=0
    while IFS="$TAB" read -r name b64 || [ -n "${name:-}" ]; do
      [ -n "$name" ] || continue
      case "$name" in
        [0-9]*|*[!A-Za-z0-9_]*) echo "refusing: invalid variable name" >&2; rm -rf "$new"; exit 1 ;;
      esac
      if ! printf '%s' "$b64" | base64 -d > "$new/$name" 2>/dev/null; then
        echo "refusing: bad encoding" >&2; rm -rf "$new"; exit 1
      fi
      chmod 400 "$new/$name"; count=$((count + 1)); name=""
    done
    [ "$count" -gt 0 ] || { echo "refusing: empty bundle" >&2; rm -rf "$new"; exit 1; }
    old="$ROOT.old.$$"
    [ -d "$ROOT" ] && mv "$ROOT" "$old"
    mv "$new" "$ROOT"
    rm -rf "$old"
    echo "stored=$count" ;;
  redeploy)
    exec /home/ubuntu/greenfield/deploy-blue-green.sh --redeploy-active ;;
  *)
    echo "usage: status | put | redeploy" >&2; exit 64 ;;
esac
