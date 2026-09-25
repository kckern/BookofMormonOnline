#!/usr/bin/env bash
# Fetch a least-privilege environment for one BOM service. Secret values are
# carried over stdin or in shell memory and are never placed in argv or logs.
set -euo pipefail

PROFILE="${1:?usage: load-infisical-env.sh <backend|frontend> <output>}"
OUT="${2:?usage: load-infisical-env.sh <backend|frontend> <output>}"

INFISICAL_HOST="http://127.0.0.1:8070"
PROJECT_ID="06237bc4-9287-4587-9c0e-970fa32ccda3"
INFISICAL_ENV="dev"
SECRET_PATH="/bom"
IDENTITY_DIR="/home/bom/infisical"

case "$PROFILE" in
  backend)
    # Only values required by the backend cross the service boundary.
    ALLOWED='^(MYSQL_(HOST|PORT|USER|PASSWORD|DB)|DATABASE_URL|REDIS_URL|MESSENGER_BOT_TOKEN|OPENAI_(BOT|EMBED)_API_KEY|QDRANT_(URL|API_KEY)|SEARCH_(BACKEND|EMBED_MODEL)|S3_BUCKET|S3_PUBLIC_URL|CLOUDFRONT_DISTRIBUTION_ID)$'
    ;;
  frontend)
    # Frontend processes receive no vault secrets.
    ALLOWED='a^'
    ;;
  *)
    echo "load-infisical-env: unsupported profile" >&2
    exit 2
    ;;
esac

CID_FILE="$IDENTITY_DIR/.client-id"
CSEC_FILE="$IDENTITY_DIR/.client-secret"
if [[ ! -r "$CID_FILE" || ! -r "$CSEC_FILE" ]]; then
  echo "load-infisical-env: machine identity unavailable" >&2
  exit 1
fi

CID="$(<"$CID_FILE")"
CSEC="$(<"$CSEC_FILE")"
TOKEN="$(jq -nc --arg clientId "$CID" --arg clientSecret "$CSEC" \
  '{clientId:$clientId,clientSecret:$clientSecret}' \
  | curl -fsS -X POST "$INFISICAL_HOST/api/v1/auth/universal-auth/login" \
      -H 'Content-Type: application/json' --data-binary @- \
  | jq -er '.accessToken')"

ENCPATH="$(jq -nr --arg p "$SECRET_PATH" '$p|@uri')"
SECRETS_JSON="$(printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" \
  | curl -fsS -K - \
      "$INFISICAL_HOST/api/v3/secrets/raw?environment=$INFISICAL_ENV&secretPath=$ENCPATH&workspaceId=$PROJECT_ID")"

umask 077
TMP="$(mktemp "${OUT}.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
{
  jq -r --arg allowed "$ALLOWED" \
    '.secrets[] | select(.secretKey|test($allowed)) | "\(.secretKey)=\(.secretValue|@sh)"' \
    <<< "$SECRETS_JSON"
  echo 'NODE_ENV=development'
  if [[ "$PROFILE" == backend ]]; then
    echo 'PORT=5006'
    echo 'BIND_HOST=127.0.0.1'
    echo 'SANDBOX=1'
    echo 'MESSENGER_ENABLED=true'
    echo 'BOT_REALTIME_RESPONDER_ENABLED=false'
    echo 'BOT_SCHEDULER_ENABLED=false'
    echo 'BOT_LLM_REASONING_EFFORT=medium'
    echo 'BOT_LLM_MAX_OUTPUT_TOKENS=600'
    echo 'BOT_LLM_TIMEOUT_MS=60000'
    echo 'BOT_LLM_HOURLY_LIMIT=30'
    echo 'BOT_LLM_DAILY_LIMIT=100'
    echo 'BOT_LOG_CONTENT=false'
  else
    echo 'HOST=0.0.0.0'
    echo 'FRONTEND_PORT=8200'
  fi
} > "$TMP"
chmod 600 "$TMP"
mv -f "$TMP" "$OUT"
trap - EXIT
echo "load-infisical-env: wrote profile $PROFILE"
