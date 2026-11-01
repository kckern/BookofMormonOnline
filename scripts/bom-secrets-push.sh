#!/usr/bin/env bash
# Push BoM runtime config (Infisical prod, folder /bom-runtime) into the EC2 box's RAM.
# Runs as user `bom` on homeserver. One-way: homeserver connects out; the box holds no way back.
# Usage: bom-secrets-push.sh push | status | redeploy | push-redeploy | ensure
#   push           replace the box's RAM bundle (running containers keep the old one)
#   status         print files=N (N = variables the box holds; 0 after a reboot)
#   redeploy       restart the active slot so it picks up the current bundle
#   push-redeploy  push, then redeploy (use this to rotate)
#   ensure         if the box reports files=0, push + redeploy (reboot recovery timer); also
#                  retries a redeploy that failed after an earlier ensure push
# Rotate with push-redeploy; a plain push leaves running containers on the previous bundle and
# breaks docker exec one-off jobs until a redeploy.
# Values are never printed, written to disk, or put in argv.
set -euo pipefail
set +x; unset BASH_XTRACEFD   # never debug with -x: the trace would print values and the token
shopt -s inherit_errexit 2>/dev/null || true   # bash >= 4.4; every step is also checked explicitly
HOST="${BOM_SECRETS_HOST:-bomsecrets@52.42.0.250}"
KEY="${BOM_SECRETS_KEY:-$HOME/.ssh/bom_secrets_ed25519}"
KNOWN_HOSTS="${BOM_SECRETS_KNOWN_HOSTS:-$HOME/.ssh/bom_secrets_known_hosts}"   # line: bom-prod <key>
PENDING="${XDG_RUNTIME_DIR:-$HOME/.cache}/bom-secrets-redeploy-pending"

usage() { echo "usage: $0 push|status|redeploy|push-redeploy|ensure (rotate with push-redeploy)" >&2; }

# Host key pinned under alias bom-prod; ~/.ssh/config ignored. Only put reads stdin. The timeout
# bounds a hung session (the box runs redeploy in its own unit, so cutting ssh does not kill it).
remote() {
  local t=() n=(-n)
  if command -v timeout >/dev/null 2>&1; then t=(timeout 1800); fi
  [ "$1" != put ] || n=()
  ${t[@]+"${t[@]}"} ssh -F none ${n[@]+"${n[@]}"} -T -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes \
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -o HostKeyAlias=bom-prod \
    -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 "$HOST" "$1"
}

# Self-contained (Task 6 sources this function alone). Prints the raw API JSON on stdout.
fetch_json() {
  # Test hook: a canned API response, honored only under BOM_SECRETS_TEST=1.
  if [ "${BOM_SECRETS_TEST:-}" = 1 ] && [ -n "${BOM_SECRETS_BUNDLE_JSON:-}" ]; then
    cat -- "$BOM_SECRETS_BUNDLE_JSON"; return
  fi
  local id_dir="${BOM_INFISICAL_DIR:-$HOME/infisical}" host="${BOM_INFISICAL_HOST:-http://127.0.0.1:8070}"
  local path="${BOM_SECRETS_PATH:-/bom-runtime}" token project tok_re='^[A-Za-z0-9._~+/=-]+$'
  project="$(tr -d '[:space:]' < "$id_dir/.prod-project-id")" || return 1
  # Client id/secret go to jq via --rawfile and to curl via stdin; the token via curl -K - (stdin).
  token="$(jq -nc --rawfile id "$id_dir/.client-id" --rawfile sec "$id_dir/.client-secret" \
      '{clientId:($id|rtrimstr("\n")),clientSecret:($sec|rtrimstr("\n"))}' \
    | curl -q -fsS -m 20 -X POST -H 'Content-Type: application/json' --data-binary @- \
        "$host/api/v1/auth/universal-auth/login" \
    | jq -er '.accessToken | strings' 2>/dev/null)" || { echo "infisical login failed" >&2; return 1; }
  [[ $token =~ $tok_re ]] || { echo "infisical login returned no usable token" >&2; return 1; }
  printf 'header = "Authorization: Bearer %s"\n' "$token" \
    | curl -q -fsS -m 20 -K - --get --data-urlencode "environment=prod" \
        --data-urlencode "secretPath=$path" --data-urlencode "workspaceId=$project" \
        --data-urlencode "expandSecretReferences=true" \
        "$host/api/v3/secrets/raw"
}

# Mirrors the receiver's rules so a bad Infisical entry fails here with a clear message. Prints
# one fixed reason (never a value), or "ok".
CHECK='
  def name_ok: test("^[A-Za-z_][A-Za-z0-9_]*\\z");
  def reserved: test("^(BOM_.*|PATH|NODE_OPTIONS|LD_.*)\\z");
  if type != "object" or (.secrets | type) != "array" then "response has no secrets list"
  elif (.secrets | length) == 0 then "no runtime config found (zero secrets)"
  elif (.secrets | length) > 256 then "more than 256 variables"
  elif any(.secrets[]; type != "object" or (.secretKey | type) != "string"
                       or (.secretValue | type) != "string") then "secret without string name/value"
  elif any(.secrets[]; .secretKey | name_ok | not) then "invalid variable name"
  elif any(.secrets[]; .secretKey | reserved) then "reserved variable name (BOM_*, PATH, NODE_OPTIONS, LD_*)"
  elif any(.secrets[]; .secretValue | @base64 | length > 65536) then "value too large (base64 > 65536 chars)"
  elif ([.secrets[].secretKey] | length) != ([.secrets[].secretKey] | unique | length) then "duplicate variable name"
  else "ok" end'

# Builds the whole stream (lines NAME<TAB>base64(value), then .END<TAB>N) in memory, so a failed
# or bad fetch means ssh is never started. jq's stderr is discarded: its errors can quote input.
# printf | jq, never a here-string: bash may back here-strings with a temp file.
bundle() {
  local json why out
  json="$(fetch_json)" && [ -n "$json" ] || { echo "fetching runtime config failed" >&2; return 1; }
  why="$(printf '%s' "$json" | jq -r "$CHECK" 2>/dev/null)" || why="response is not valid JSON"
  [ "$why" = ok ] || { echo "refusing to push: ${why:-response is not valid JSON}" >&2; return 1; }
  out="$(printf '%s' "$json" \
    | jq -r '(.secrets[] | "\(.secretKey)\t\(.secretValue | @base64)"), ".END\t\(.secrets | length)"' 2>/dev/null)" \
    && [ -n "$out" ] || { echo "encoding runtime config failed" >&2; return 1; }
  printf '%s\n' "$out"
}

push() {
  local b
  b="$(bundle)" || return 1
  printf '%s\n' "$b" | remote put   # printf is a builtin: the bundle never appears in argv
}

# The pending marker survives a failed redeploy, so the next run retries it even though the box
# now reports files>0.
ensure() {
  local st
  st="$(remote status)" || return 1
  case "$st" in
    files=0)
      echo "box has no runtime config (rebooted?); re-pushing" >&2
      mkdir -p "${PENDING%/*}" && : > "$PENDING" || return 1
      push || return 1
      remote redeploy || return 1
      rm -f "$PENDING" ;;
    files=[1-9]*)
      if [ -e "$PENDING" ]; then
        echo "redeploy pending from an earlier run; retrying" >&2
        remote redeploy || return 1
        rm -f "$PENDING"
      fi ;;
    *) echo "unexpected status reply from box" >&2; return 1 ;;
  esac
}

case "${1:-}" in
  push)          push ;;
  status)        remote status ;;
  redeploy)      remote redeploy ;;
  push-redeploy) push && remote redeploy ;;
  ensure)        ensure ;;
  *)             usage; exit 64 ;;
esac
