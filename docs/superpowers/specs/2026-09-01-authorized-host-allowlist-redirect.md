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
// (health checks, dev, IP-literal hosts, single-label internal names,
// hostless internal requests).
export function isInfraHost(host: string | null | undefined): boolean {
  const bare = normalizeHost(host)
  if (!bare) return true                                  // hostless
  if (bare === 'localhost' || bare.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return true    // IPv4 literal
  if (bare.startsWith('[')) return true                    // IPv6 literal ([::1]:port)
  // Single-label host (no dot) = an internal/service name (e.g. `bom-app`),
  // never a public site. Treating it as infra FAILS SAFE: if the proxy ever
  // delivers a dot-less Host with no x-forwarded-host, we serve rather than
  // 301 every request (including language hosts) to canonical English.
  if (!bare.includes('.')) return true
  return false
}
```

**Pre-ship verification (blocking):** before enabling, confirm what the prod
proxy chain (ALB → NPM) actually forwards — specifically whether
`x-forwarded-host` is always present and whether `Host` is preserved or rewritten
to an internal name. `langForHost` working in prod today proves only that *one* of
the two headers carries the public host, not which — so the allowlist must be
validated against the real header shape, not assumed.

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
  // Hardcode https — the site is HTTPS-only and markResponse sets HSTS; keying
  // off x-forwarded-proto risks emitting an http:// Location (extra upgrade hop).
  const target = `https://${CANONICAL_EN_HOST}${pathname}${request.nextUrl.search}`
  return markResponse(NextResponse.redirect(target, 301), clientClass)
}
```

**301 vs. non-GET:** a 301 downgrades a browser `POST` to `GET`. The middleware
sends GraphQL as `POST /{lang}` (`middleware.ts:163-165`), so a stale SPA left
open on an alias host would fail its next API POST. That is **intended** — the
point is to evict traffic from unauthorized hosts; a cross-origin replay to
canonical would hit CORS regardless. We accept 301 (cache-friendly canonicalization,
consistent with the existing `www` redirect) rather than 308.

**301 caching:** browsers and Cloudflare cache 301s aggressively (dev edge TTL is
4h per CLAUDE.md; browsers effectively forever). Consequence: if a host is later
promoted into `EN_EDITION_HOSTS`, previously-issued 301s keep firing for returning
visitors until caches expire. **Promotion runbook:** add the host to the registry,
then purge Cloudflare for that host; accept a tail of cached stragglers. (We do not
set a short `Cache-Control` on the redirect — long-lived canonicalization is the
desired default for the permanent alias case.)

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
  ├─ www.* (keyed off nextUrl.hostname) ... 301 → bare (existing, unchanged)
  │
  │  host = x-forwarded-host ?? host
  ├─ isInfraHost(host) ................... pass through (health / dev / IP / single-label)
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
- **`www.<language-host>`** (e.g. `www.swe.bookofmormon.online`) → if the pre-existing
  `www` redirect keys off `nextUrl.hostname` and that carries the internal origin in
  prod, the `www` strip won't fire and the new block sends the user to canonical
  **English**, not `swe.`. Rare; a real fix requires the `www` redirect to also read
  `x-forwarded-host` (out of scope, but the pre-ship verification above will reveal
  whether this is a live problem). Bonus: in that same scenario the new block
  correctly backstops bare `www.bookofmormon.online` (not in `HOST_LANG`) → apex.

## Testing

**Existing tests that WILL break and must be rewritten (blocking):**

- `frontend/next/test/routes/korean.test.ts:51` — "untrusted host still falls back
  to apex" sends `x-forwarded-host: evil.example.com` and asserts **200** with apex
  canonical. Under the new block this becomes a **301**. Rewrite to assert the 301 →
  `https://bookofmormon.online…`.
- `frontend/next/test/routes/seo-gating.test.ts:88` — uses `ko.bookofmormon.online`,
  which is **not** in `HOST_LANG` (Korean hosts are `몰몬경.kr` / punycode). It passes
  today only because of the `safeHost` `*.bookofmormon.online` wildcard we're removing.
  Rewrite to either use a real `HOST_LANG` Korean host or assert the 301. Check for
  other tests leaning on that wildcard too.
- **All redirect assertions must set `maxRedirects: 0`** (Playwright `request.get`
  follows redirects by default — otherwise a failed assertion chases `Location` out to
  the live production site).

**New tests** (mirroring existing `frontend/next/` harnesses — Playwright against
`next dev` with injected `x-forwarded-host`, unit tests in `test/unit/locales.test.ts`
style):

1. `isAuthorizedHost` — true for every `HOST_LANG` key and `EN_EDITION_HOSTS` key;
   false for `new.`, `opengraph.`, `sugardoodle.`, and a random external domain.
2. `isInfraHost` — true for `localhost`, `127.0.0.1`, `10.0.1.12`, `[::1]:8200`,
   `bom-app` (single-label), `''`; false for real public multi-label hosts.
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
- [ ] Pre-ship: prod ALB→NPM header shape verified (`x-forwarded-host` present / `Host`
      handling known) before the block is enabled.
- [ ] Existing `korean.test.ts` / `seo-gating.test.ts` host-fallback cases rewritten to
      expect 301, all with `maxRedirects: 0`.
- [ ] New tests above pass.
