#!/bin/sh
# secret-scan.sh — read "path:lineno:content" lines on stdin, report likely secrets /
# PII, exit 1 if any are found (else 0). Shared by the pre-commit hook and manual audits.
# POSIX sh + grep/awk only — no external dependencies, so it works for anyone who clones.
#
# Escape hatches:
#   - add a literal to .githooks/allowlist.txt (a line containing it is skipped), or
#   - append  # pragma: allowlist secret  to the offending line.
set -u

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo .)
ALLOW="$ROOT/.githooks/allowlist.txt"

work=$(mktemp); report=$(mktemp); ips=$(mktemp)
trap 'rm -f "$work" "$work.1" "$report" "$ips"' EXIT
cat > "$work"

# Skip vendored / minified / generated / binary-ish paths — noisy and not authored here
# (e.g. tinymce icons.min.js SVG path data reads like IPs).
# (.githooks/ holds the detection patterns + allowlist literals themselves, so it is skipped.)
grep -vE '^([^:]*(\.min\.(js|css)|/tinymce/|\.(png|jpe?g|gif|webp|ico|svg|ttf|woff2?|eot|pdf|map)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)|\.githooks/[^:]*):' "$work" > "$work.1" 2>/dev/null && mv "$work.1" "$work"

# Skip lines the author explicitly marked as a known-safe false positive.
grep -vi 'pragma:[[:space:]]*allowlist[[:space:]]*secret' "$work" > "$work.1" 2>/dev/null && mv "$work.1" "$work"

# Skip lines containing an allowlisted literal.
if [ -f "$ALLOW" ]; then
  al=$(mktemp); grep -vE '^[[:space:]]*(#|$)' "$ALLOW" > "$al" 2>/dev/null || true
  if [ -s "$al" ]; then grep -vFf "$al" "$work" > "$work.1" 2>/dev/null && mv "$work.1" "$work"; fi
  rm -f "$al"
fi

emit() { # $1 = category; stdin = matching "path:lineno:content" lines
  out=$(cat)
  [ -n "$out" ] || return 0
  { printf '\n  [%s]\n' "$1"; printf '%s\n' "$out" | cut -c1-200 | sed 's/^/    /'; } >> "$report"
}

# --- Unambiguous secrets --------------------------------------------------------------
grep -E  -- '-----BEGIN [A-Z ]*PRIVATE KEY-----'                                  "$work" | emit "Private key"
grep -E  -- '(AKIA|ASIA)[0-9A-Z]{16}'                                             "$work" | emit "AWS access key id"
grep -E  -- '(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{20,}'  "$work" | emit "GitHub token"
grep -E  -- 'xox[baprs]-[0-9A-Za-z-]{8,}'                                         "$work" | emit "Slack token"
grep -E  -- 'AIza[0-9A-Za-z_-]{35}'                                               "$work" | emit "Google API key"

# --- Hardcoded credential assignment (best-effort; excludes env refs / placeholders) --
grep -Ei -- '(password|passwd|secret|api[_-]?key|access[_-]?key|client_secret|auth[_-]?token|bearer)[a-z_]*["'"'"' ]*[:=]["'"'"' ]*[^"'"'"' <$)]{8,}' "$work" \
  | grep -Eiv 'process\.env|import\.meta|config\.|options?\.|settings\.|this\.|req\.|ctx\.|placeholder|example|changeme|your[_-]|redacted|dummy|sample|test[_-]|xxxx|<[^>]+>|\$\{|\bnull\b|\bundefined\b|\*\*\*' \
  | emit "Possible hardcoded secret"

# --- Public IPv4 (PII / infra) --------------------------------------------------------
# Classify each candidate; skip private, loopback, link-local, CGNAT, RFC 5737 doc ranges,
# browser-version-like X.0.0.0, and well-known public resolvers.
grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' "$work" 2>/dev/null | while IFS= read -r line; do
  for ip in $(printf '%s' "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'); do
    case "$ip" in
      10.*|127.*|0.*|255.*|169.254.*|192.168.*) continue ;;
      172.1[6-9].*|172.2[0-9].*|172.3[01].*) continue ;;
      192.0.2.*|198.51.100.*|203.0.113.*) continue ;;                       # RFC 5737 docs
      100.6[4-9].*|100.[7-9][0-9].*|100.1[01][0-9].*|100.12[0-7].*) continue ;;  # CGNAT
      *.0.0.0) continue ;;                                                  # Chrome/119.0.0.0
      1.1.1.1|8.8.8.8|8.8.4.4) continue ;;
    esac
    printf '%s' "$ip" | awk -F. '{for(i=1;i<=4;i++) if($i+0>255) exit 1}' || continue
    printf '%s\n' "$line" >> "$ips"
    break
  done
done
[ -s "$ips" ] && sort -u "$ips" | emit "Public IP address (PII/infra)"

# --- Email addresses (PII) ------------------------------------------------------------
grep -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$work" 2>/dev/null \
  | grep -Eiv '@example\.(com|org|net)|noreply@|no-reply@' \
  | emit "Email address (PII)"

if [ -s "$report" ]; then
  cat "$report"
  exit 1
fi
exit 0
