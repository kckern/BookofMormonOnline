#!/usr/bin/env bash
# Run a command with prod credentials from local Infisical; nothing is printed.
# usage: with-prod-secrets.sh aws|ssh -- cmd args…
#   aws: exports AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION and S3_BUCKET
#   ssh: exports PROD_HOST and PROD_KEY_FILE (key written 0600 under $XDG_RUNTIME_DIR)
# Needs local files (outside the repo): /home/bom/infisical/{.client-id,.client-secret,.prod-project-id}
set -euo pipefail
MODE="${1:?usage: with-prod-secrets.sh aws|ssh -- cmd…}"; shift
[ "${1:-}" = "--" ] && shift
ID_DIR=/home/bom/infisical
CID="$(<"$ID_DIR/.client-id")"; CSEC="$(<"$ID_DIR/.client-secret")"
PID="$(<"$ID_DIR/.prod-project-id")"   # local file, outside the repo (public repo: no infra IDs in commits)
TOKEN="$(jq -n --arg a "$CID" --arg b "$CSEC" '{clientId:$a,clientSecret:$b}' \
  | curl -fsS -X POST http://127.0.0.1:8070/api/v1/auth/universal-auth/login -H 'Content-Type: application/json' --data-binary @- | jq -er .accessToken)"
SECRETS="$(printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" \
  | curl -fsS -K - "http://127.0.0.1:8070/api/v3/secrets/raw?environment=prod&secretPath=%2F&workspaceId=$PID")"  # pragma: allowlist secret
get() { jq -er --arg k "$1" '.secrets[]|select(.secretKey==$k).secretValue' <<<"$SECRETS"; }
unset TOKEN CSEC
case "$MODE" in
  aws)
    export AWS_ACCESS_KEY_ID="$(get AWS_KEY)" AWS_SECRET_ACCESS_KEY="$(get AWS_SECRET)" AWS_REGION=us-west-2 AWS_DEFAULT_REGION=us-west-2
    APP="$(~/.local/bin/aws secretsmanager get-secret-value --secret-id bom/prod/app --query SecretString --output text)"
    export S3_BUCKET="$(jq -er .S3_BUCKET <<<"$APP")"; unset APP ;;
  ssh)
    export PROD_HOST="$(get HOST)"
    export PROD_KEY_FILE="$XDG_RUNTIME_DIR/prod_key"
    umask 077; get SSH > "$PROD_KEY_FILE"; chmod 600 "$PROD_KEY_FILE" ;;
  *) echo "mode must be aws or ssh" >&2; exit 2 ;;
esac
unset SECRETS
exec "$@"
