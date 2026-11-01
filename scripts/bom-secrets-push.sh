#!/usr/bin/env bash
# Push BoM runtime config (Infisical prod, folder /bom-runtime) into the EC2 box's RAM.
# Runs as user `bom` on homeserver. One-way: homeserver connects out; the box holds no way back.
# Usage: bom-secrets-push.sh push | status | redeploy | push-redeploy | ensure
#   push           replace the box's RAM bundle (running containers keep the old one)
#   status         print files=N (N = variables the box holds; 0 after a reboot)
#   redeploy       restart the active slot so it picks up the current bundle
#   push-redeploy  push, then redeploy (use this to rotate)
#   ensure         if the box reports files=0, push + redeploy (reboot recovery timer)
# Rotate with push-redeploy; a plain push leaves running containers on the previous bundle and
# breaks docker exec one-off jobs until a redeploy.
# Values are never printed, written to disk, or put in argv.
set -euo pipefail
shopt -s inherit_errexit 2>/dev/null || true   # bash >= 4.4; every step is also checked explicitly
cmd="${1:-status}"
HOST="${BOM_SECRETS_HOST:-bomsecrets@52.42.0.250}"
KEY="${BOM_SECRETS_KEY:-$HOME/.ssh/bom_secrets_ed25519}"

usage() { echo "usage: $0 push|status|redeploy|push-redeploy|ensure (rotate with push-redeploy)" >&2; }

remote() { ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 \
  -o ServerAliveInterval=5 -o ServerAliveCountMax=3 "$HOST" "$1"; }

# Self-contained (Task 6 sources this function alone). Prints the raw API JSON on stdout.
fetch_json() {  # test hook: BOM_SECRETS_BUNDLE_JSON points at a canned API response
  if [ -n "${BOM_SECRETS_BUNDLE_JSON:-}" ]; then cat -- "$BOM_SECRETS_BUNDLE_JSON"; return; fi
  local id_dir="${BOM_INFISICAL_DIR:-$HOME/infisical}" host="${BOM_INFISICAL_HOST:-http://127.0.0.1:8070}"
  local path="${BOM_SECRETS_PATH:-/bom-runtime}" token project
  project="$(tr -d '[:space:]' < "$id_dir/.prod-project-id")" || return 1
  # Client id/secret go to jq via --rawfile and to curl via stdin; the token via curl -K - (stdin).
  token="$(jq -nc --rawfile id "$id_dir/.client-id" --rawfile sec "$id_dir/.client-secret" \
      '{clientId:($id|rtrimstr("\n")),clientSecret:($sec|rtrimstr("\n"))}' \
    | curl -fsS -m 20 -X POST -H 'Content-Type: application/json' --data-binary @- \
        "$host/api/v1/auth/universal-auth/login" \
    | jq -er '.accessToken | strings' 2>/dev/null)" || { echo "infisical login failed" >&2; return 1; }
  printf 'header = "Authorization: Bearer %s"\n' "$token" \
    | curl -fsS -m 20 -K - --get --data-urlencode "environment=prod" \
        --data-urlencode "secretPath=$path" --data-urlencode "workspaceId=$project" \
        "$host/api/v3/secrets/raw"
}

# Builds the whole stream (lines NAME<TAB>base64(value), then .END<TAB>N) in memory, so a failed
# or empty fetch means ssh is never started. jq's stderr is discarded: its type errors quote input.
bundle() {
  local json out
  json="$(fetch_json)" && [ -n "$json" ] || { echo "fetching runtime config failed" >&2; return 1; }
  # printf | jq, not a here-string: bash may back here-strings with a temp file.
  out="$(printf '%s' "$json" | jq -r '
      .secrets as $s
      | if ($s | type) != "array" or ($s | length) == 0 then error("none") else . end
      | if all($s[]; (.secretKey | type) == "string" and (.secretKey | test("^[A-Za-z_][A-Za-z0-9_]*$"))
                     and (.secretValue | type) == "string") then . else error("bad") end
      | ($s[] | "\(.secretKey)\t\(.secretValue | @base64)"), ".END\t\($s | length)"
    ' 2>/dev/null)" || { echo "no usable runtime config in Infisical response" >&2; return 1; }
  [ -n "$out" ] || { echo "no usable runtime config in Infisical response" >&2; return 1; }
  printf '%s\n' "$out"
}

push() {
  local b
  b="$(bundle)" || return 1
  printf '%s\n' "$b" | remote put   # printf is a builtin: the bundle never appears in argv
}

ensure() {
  local st
  st="$(remote status)"
  case "$st" in
    files=0) echo "box has no runtime config (rebooted?); re-pushing" >&2
             push && remote redeploy ;;
    files=[1-9]*) ;;
    *) echo "unexpected status reply from box" >&2; return 1 ;;
  esac
}

case "$cmd" in
  push)          push ;;
  status)        remote status ;;
  redeploy)      remote redeploy ;;
  push-redeploy) push && remote redeploy ;;
  ensure)        ensure ;;
  *)             usage; exit 64 ;;
esac
