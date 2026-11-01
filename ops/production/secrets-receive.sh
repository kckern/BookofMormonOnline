#!/bin/sh
# Forced-command endpoint for homeserver's push key (installed as /usr/local/sbin/bom-secrets-receive).
# Commands (via SSH_ORIGINAL_COMMAND): status | put | redeploy. Never prints values.
# put reads lines "NAME<TAB>base64(value)" on stdin, then a trailer ".END<TAB>N" (N = number of
# variable lines), and atomically replaces the bundle dir. Anything short of that is refused.
set -eu
if [ "$(id -u)" = 0 ]; then
  ROOT=/run/bom-secrets; SKIP_TMPFS_CHECK=0          # test overrides never apply in production
else
  ROOT="${BOM_SECRETS_ROOT:-/run/bom-secrets}"; SKIP_TMPFS_CHECK="${BOM_SECRETS_SKIP_TMPFS_CHECK:-0}"
fi
PARENT="$(dirname "$ROOT")"
LOCK="$PARENT/bom-secrets.lock.d"
TAB="$(printf '\t')"
MAX_VARS=256
MAX_B64=65536
umask 077

refuse() { echo "refusing: $1" >&2; exit 1; }

new=""; old=""; locked=0
cleanup() {
  set +e                                             # best effort: always reach the lock release
  [ -z "$new" ] || rm -rf "$new"
  if [ -n "$old" ] && [ -d "$old" ] && [ ! -e "$ROOT" ]; then mv "$old" "$ROOT"; fi
  [ -z "$old" ] || [ ! -e "$ROOT" ] || rm -rf "$old"
  [ "$locked" != 1 ] || rmdir "$LOCK"
}

case "${SSH_ORIGINAL_COMMAND:-}" in
  status)
    n=0; [ -d "$ROOT" ] && n=$(find "$ROOT" -maxdepth 1 -type f | wc -l)
    echo "files=$((n + 0))" ;;
  put)
    if [ "$SKIP_TMPFS_CHECK" != 1 ] && [ "$(findmnt -no FSTYPE --target "$PARENT")" != tmpfs ]; then
      refuse "$PARENT is not tmpfs"
    fi
    trap cleanup EXIT
    trap 'exit 1' HUP INT TERM
    tries=0
    until mkdir "$LOCK" 2>/dev/null; do
      tries=$((tries + 1)); [ "$tries" -lt 10 ] || refuse "busy: $LOCK held (stale after SIGKILL? rmdir it)"
      sleep 1
    done
    locked=1
    rm -rf "$ROOT".new.* "$ROOT".old.*                  # leftovers from a run that was killed
    new="$ROOT.new.$$"; mkdir -m 700 "$new"
    count=0; ended=0; expect=""
    while IFS= read -r line; do
      [ "$ended" = 0 ] || refuse "data after trailer"
      case "$line" in *"$TAB"*) ;; *) refuse "malformed line" ;; esac
      name="${line%%"$TAB"*}"; b64="${line#*"$TAB"}"
      if [ "$name" = .END ]; then
        case "$b64" in ''|*[!0-9]*) refuse "malformed trailer" ;; esac
        expect="$b64"; ended=1; continue
      fi
      case "$name" in
        ''|[0-9]*|*[!A-Za-z0-9_]*) refuse "invalid variable name" ;;
        BOM_*|PATH|NODE_OPTIONS|LD_*) refuse "reserved variable name" ;;
      esac
      [ "$count" -lt "$MAX_VARS" ] || refuse "more than $MAX_VARS variables"
      [ "${#b64}" -le "$MAX_B64" ] || refuse "value too large"
      [ ! -e "$new/$name" ] || refuse "duplicate variable name"
      printf '%s' "$b64" | base64 -d > "$new/$name" 2>/dev/null || refuse "bad encoding"
      chmod 400 "$new/$name"; count=$((count + 1))
    done
    [ "$ended" = 1 ] || refuse "missing trailer (truncated stream?)"
    [ "$expect" -eq "$count" ] || refuse "trailer count mismatch"
    [ "$count" -gt 0 ] || refuse "empty bundle"
    old="$ROOT.old.$$"
    if [ -d "$ROOT" ]; then mv "$ROOT" "$old"; fi
    [ ! -e "$ROOT" ] || refuse "$ROOT is in the way"
    mv "$new" "$ROOT"; new=""
    rm -rf "$old"; old=""
    echo "stored=$count" ;;
  redeploy)
    # Own transient unit: a dropped SSH session (homeserver timeout) cannot kill a deploy mid-way,
    # and the fixed name refuses a second concurrent redeploy. Output goes to the journal.
    # HOME=/root matches the old sudo environment (aws/cosign look there).
    exec systemd-run --wait --collect --quiet --unit=bom-redeploy --property=UMask=0022 --setenv=HOME=/root /home/ubuntu/greenfield/deploy-blue-green.sh --redeploy-active ;;
  *)
    echo "usage: status | put | redeploy" >&2; exit 64 ;;
esac
