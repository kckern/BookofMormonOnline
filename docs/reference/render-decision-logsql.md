# render-decision LogsQL queries

The Next front door (`frontend/next/middleware.ts`) emits one JSON line per page
navigation via `logRenderDecision`, shipped to VictoriaLogs by Vector's
`docker_logs` source. Fields live inside `_msg`; `unpack_json from _msg` extracts
them at query time (no ingest transform — decision 3a).

This stream is **navigation-only** — `logRenderDecision` skips non-`isNav`
requests, CRA assets, and SEO assets — so every row already has `isNav=true`.

Base selector (prepend to every query below):

    _stream:{container_name=~"bookofmormon-online.*"} render-decision | unpack_json from _msg

Run against VictoriaLogs at `:9428/select/logsql/query` (on the prod box), e.g

    curl -s http://localhost:9428/select/logsql/query \
      --data-urlencode 'query=<one line below>' --data-urlencode 'start=1h'

## 1. Human→SSR misroutes (the primary tripwire — should be ~0)
    … | filter suspect:true | stats by (ua) count() n
Any rows here are real browsers served the static page. Investigate the UA.

## 2. Render distribution
    … | stats by (render) count() n
Sanity check of cra vs ssr share.

## 3. Crawler family breakdown
    … | filter class:known-crawler | stats by (crawlerFamily) count() n

## 4. Mobile served the CRA (the originally-reported symptom — should be healthy)
    … | filter isMobile:true render:cra | stats count() n

## 5. Unknown-UA review (are any unknown→ssr actually browsers?)
    … | filter class:unknown | stats by (ua) count() n | sort by (n desc) | limit 50

## 6. isbot false-positives (real browsers flagged as bots → SSR, incl. headless)
    … | filter class:known-crawler browserUa:true | stats by (ua) count() n | sort by (n desc)
Expected: HeadlessChrome / Chrome-Lighthouse (accepted). An *interactive* browser
here is a real false-positive worth fixing.

## 7. Decisive-signal mix
    … | stats by (signal) count() n
Shows how often isbot vs the browser-UA test vs the applewebkit (in-app WebView)
path drives the decision.

## 8. Bot→CRA leaks (two layers)
**(a) Routing regression.** `leak` is computed at serve-time
(`servedMode==='cra' && isbotHit`), so a hit means a known crawler actually
reached the CRA — a middleware routing bug. Should be 0 (isbot→SSR by
construction):

    … | filter leak:true | stats by (ua) count() n

**(b) UA-spoofing leak.** A scraper sending a clean Chrome UA is classified
`browser` and correctly not flagged — that residual signal is undetectable from
UA alone and is IP-based, on the `bom_access` stream. That stream is parsed AT
INGEST (`parse_json!(.message)` in vector.yaml), so `client_class`/`client_ip`/
`crawler_family` are already first-class fields — do NOT `unpack_json` here (its
`_msg` is a URI):

    _stream:{source_type="bom_access"} | filter client_class:browser | stats by (client_ip) count() n | sort by (n desc) | limit 50
Cross-reference high-volume IPs against known datacenter ASNs.
