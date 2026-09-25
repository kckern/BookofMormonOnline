#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:?missing profile}"
OUT="${2:?missing runtime env path}"
shift 2
[[ $# -gt 0 ]] || { echo "run-with-infisical-env: missing command" >&2; exit 2; }

"$(dirname "$0")/load-infisical-env.sh" "$PROFILE" "$OUT"
set -a
# shellcheck disable=SC1090
source "$OUT"
set +a
exec "$@"
