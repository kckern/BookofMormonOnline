# Authorized-host allowlist + canonical redirect

**Date:** 2026-09-01
**Status:** Design — awaiting review
**Component:** `frontend/next/` (Next.js front door / middleware)

## Problem

Any host that resolves to the app currently serves the full site under its own
name. That is correct for the **authorized language hosts** (`swe.bookofmormon.online`,
`buchmormon.de`, etc.), but wrong for **English aliases**. Subdomains like
`new.bookofmormon.online`, `opengraph.bookofmormon.online`, and
`sugardoodle.bookofmormon.online` are currently browsable as standalone English
sites (observed live in the Clicky log, all reporting into one site).

There must be **one canonical English home** (`bookofmormon.online`). Every English
host that is not explicitly authorized must **hard-redirect** to it — not proxy,
not serve a copy — so it is impossible to keep browsing on the wrong host.

The rule is an **allowlist, not a denylist**: an explicit registry classifies every
incoming host. Anything not in the registry redirects to canonical by default.

### Root cause (current gaps)

- `frontend/next/lib/locales.ts:46` — `langForHost()` **defaults unknown hosts to
  `'en'`** and the middleware then serves them normally. No rejection.
- `frontend/next/lib/seo.ts:113` — `safeHost()` treats **any `*.bookofmormon.online`**
  as valid for canonical/og:url, so aliases also get "legitimate" SEO metadata.
- `frontend/next/middleware.ts:123` — the only existing host redirect is `www.* → bare`.

## Goals

1. A single source-of-truth registry of **authorized hosts**.
2. Middleware redirects any **unauthorized** host to canonical English,
   **preserving path + query**, with **301**.
3. The redirect fires **before** the SSR/CRA branch, so unauthorized hosts redirect
   for crawlers/SSR fetchers **and** browsers alike — including
   `opengraph.bookofmormon.online`. No unauthorized host renders anything.
4. Infra/local requests (health checks, localhost, IP-literal hosts) are **never**
   redirected.
5. Adding a new language or a new authorized English edition is a **one-line config
   change**.

## Non-goals

- Language hosts stay exactly as they are (`HOST_LANG` unchanged in behavior).
- No new brand-partner or alt-translation subdomains are created now — the design
  only leaves a defined place to add them later.
- No denylist of specific bad hosts.

## Authorized-host taxonomy

| Class | Source | Behavior |
|---|---|---|
| Canonical English | `HOST_LANG['bookofmormon.online'] = 'en'` | Serve normally |
| Language subdomains / domains | `HOST_LANG` (all other entries) | Serve normally |
| Authorized English editions (future) | `EN_EDITION_HOSTS` (new; empty now) | Serve normally |
| Infra / local | localhost, `127.0.0.1`, IP-literal, hostless | Pass through (no redirect) |
| **Everything else** | not in any of the above | **301 → canonical English, path preserved** |

"Authorized English editions" is the hard-coded slot for future cases the user
named: a brand partner, or alternate English editions (e.g. Community of Christ
versification / other English translations) that get their own defined subdomain.

## Design

### 1. Config — `frontend/next/lib/locales.ts`

Add alongside `HOST_LANG`:

```ts
// Authorized English editions / brand-partner hosts. Empty for now.
// Future entries are hard-coded here, e.g. 'cofc.bookofmormon.online': 'en-cofc'.
// A host is authorized to SERVE only if it appears in HOST_LANG or here.
export const EN_EDITION_HOSTS: Record<string, string> = {}

// Canonical English home — the redirect target for unauthorized hosts.
export const CANONICAL_EN_HOST = 'bookofmormon.online'

function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(',')[0].trim().split(':')[0].toLowerCase()
}

// True when the host is an explicitly authorized public site host.
export function isAuthorizedHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  return bare in HOST_LANG || bare in EN_EDITION_HOSTS
}

// True for infra/local requests that must never be redirected
// (health checks, dev, IP-literal hosts, hostless internal requests).
export function isInfraHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  if (!bare) return true                                  // hostless
  if (bare === 'localhost' || bare.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return true    // IPv4 literal
  if (bare.startsWith('[') || bare === '::1') return true  // IPv6 literal
  return false
}
```

`normalizeHost` already matches the stripping logic in `langForHost` and
`safeHost` (forwarded-chain first value, drop port, lowercase); those can be
refactored to reuse it, but that is optional cleanup, not required.

### 2. Middleware redirect — `frontend/next/middleware.ts`

Insert a block immediately after the existing `www.* → bare` redirect (around
`middleware.ts:128`), before the Facsimiles/Clicky/SEO/CRA logic:

```ts
// --- Host allowlist: unauthorized hosts → canonical English (path preserved) ---
// Redirect fires before the SSR/CRA branch, so crawlers and browsers alike are
// forwarded. Infra/local hosts (health checks, dev, IP literals) pass through.
const rawHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
if (!isInfraHost(rawHost) && !isAuthorizedHost(rawHost)) {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const target = `${proto}://${CANONICAL_EN_HOST}${pathname}${request.nextUrl.search}`
  return markResponse(NextResponse.redirect(target, 301), clientClass)
}
```

**Why key off `x-forwarded-host`, not `request.nextUrl.hostname`:** behind
ALB → NPM the real public host arrives in `x-forwarded-host`; `nextUrl.hostname`
can be the internal origin (e.g. `localhost`). `langForHost` already reads the
forwarded header for exactly this reason. The redirect target is built as an
**absolute URL** to `CANONICAL_EN_HOST` rather than cloning `nextUrl`, so the
internal hostname never leaks into the `Location` header.

*(Note: the pre-existing `www.*` redirect keys off `nextUrl.hostname`, which may
not carry the forwarded host in prod. Out of scope to fix here, but flagged. A
`www.<unauthorized>` host still gets redirected correctly by the new block.)*

### 3. Tighten `safeHost()` — `frontend/next/lib/seo.ts`

Replace the `bare === SITE_DOMAIN || bare.endsWith('.' + SITE_DOMAIN) || ...`
allowance with a call to `isAuthorizedHost` (plus localhost for dev), so unknown
`*.bookofmormon.online` no longer produces "valid" canonical/og:url metadata.
In practice unauthorized hosts no longer reach SSR after step 2, but this closes
the seam and keeps a single definition of "authorized."

## Data flow

```
request
  │  host = x-forwarded-host ?? host
  ├─ www.* ................................ 301 → bare (existing)
  ├─ isInfraHost(host) ................... pass through (health/dev/IP)
  ├─ !isAuthorizedHost(host) ............. 301 → https://bookofmormon.online<path><query>   ◀ NEW
  └─ authorized ......................... existing Facsimiles / Clicky / SEO / CRA / SSR flow
```

## Edge cases

- **`opengraph.bookofmormon.online`** → redirects (confirmed desired, even for SSR/
  crawler unfurls). Link-preview fetchers will re-fetch canonical and read its OG tags.
- **`www.new.bookofmormon.online`** → `www` redirect strips to `new.…`, next request
  hits the allowlist and redirects to canonical (two hops, acceptable/rare).
- **Health checks / ALB probes** hitting by IP or with no/internal host → pass through.
- **A totally unrelated domain** pointed at the app → redirects to canonical English
  (allowlist default; correct).
- **Authorized language host** (e.g. `swe.…`) → unaffected, serves normally.

## Testing

Add middleware/unit tests (mirroring existing `frontend/next/` test harnesses):

1. `isAuthorizedHost` — true for every `HOST_LANG` key and `EN_EDITION_HOSTS` key;
   false for `new.`, `opengraph.`, `sugardoodle.`, and a random external domain.
2. `isInfraHost` — true for `localhost`, `127.0.0.1`, `::1`, `10.0.1.12`, `''`;
   false for real public hosts.
3. Middleware:
   - `new.bookofmormon.online/reign-of-judges/94?x=1` → 301,
     `Location: https://bookofmormon.online/reign-of-judges/94?x=1` (path + query preserved).
   - `opengraph.bookofmormon.online/history/...` with a **crawler UA** → still 301
     (redirect precedes SSR branch).
   - `swe.bookofmormon.online/contents` → not redirected (serves).
   - `localhost` / IP host → not redirected.
   - Forwarded-host precedence: `x-forwarded-host: new.bookofmormon.online` with an
     internal `host` → redirects on the forwarded value.

## Acceptance criteria

- [ ] `new.`, `opengraph.`, `sugardoodle.` (and any other non-registered host) 301
      to `bookofmormon.online` with the original path + query, for browsers and crawlers.
- [ ] All `HOST_LANG` language hosts continue to serve normally.
- [ ] Adding a host to `HOST_LANG` or `EN_EDITION_HOSTS` makes it serve, with no
      other code change.
- [ ] Health checks / localhost / IP-literal hosts are never redirected.
- [ ] `safeHost()` no longer validates unregistered `*.bookofmormon.online`.
- [ ] Tests above pass.
