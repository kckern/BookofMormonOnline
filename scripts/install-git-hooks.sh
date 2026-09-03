#!/bin/sh
# Point git at the repo's committed hooks (.githooks) and make them executable.
# Run once after cloning:  sh scripts/install-git-hooks.sh
set -eu

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

chmod +x .githooks/pre-commit .githooks/secret-scan.sh scripts/install-git-hooks.sh 2>/dev/null || true
git config core.hooksPath .githooks

echo "✓ git hooks installed (core.hooksPath -> .githooks)"
echo "  pre-commit now scans staged changes for secrets & PII before every commit."
