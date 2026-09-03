# Git hooks

This repo is **public**. To keep secrets and PII out of history, a `pre-commit` hook scans
the changes you're about to commit and blocks the commit if it finds anything suspicious.

## Install (once per clone)

```sh
sh scripts/install-git-hooks.sh
```

This sets `core.hooksPath` to `.githooks/` (which is committed), so the hook stays in sync
with the repo. There's nothing to install globally and no dependencies — just POSIX `sh`,
`grep`, and `awk`.

## What it checks

`pre-commit` runs `secret-scan.sh` over **only the lines you are adding** in the commit
(pre-existing content is never re-flagged). It looks for:

- private keys (`-----BEGIN … PRIVATE KEY-----`)
- cloud/service tokens: AWS access-key ids (`AKIA…`), GitHub (`ghp_…`, `github_pat_…`),
  Slack (`xox…`), Google API keys (`AIza…`)
- hardcoded credential assignments (`password = "…"`, `secret: "…"`, …), excluding env
  refs and obvious placeholders
- **public IPv4 addresses** (PII/infra) — private, loopback, link-local, CGNAT, and
  RFC 5737 documentation ranges are ignored
- **email addresses** (PII), except `noreply@…` and `@example.*`

## Handling a false positive

- Add the literal value to [`allowlist.txt`](./allowlist.txt), **or**
- append `# pragma: allowlist secret` to the specific line.

To bypass the hook for a single commit (discouraged): `git commit --no-verify`.

## Audit existing files

The scanner reads `path:lineno:content` on stdin, so you can point it at anything:

```sh
# scan the whole tracked tree
git ls-files -z | xargs -0 grep -nH '' | sed 's/:\([0-9]*\):/:\1:/' \
  | sh .githooks/secret-scan.sh
```
