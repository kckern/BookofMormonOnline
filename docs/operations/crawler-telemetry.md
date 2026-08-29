# Crawler and SSR telemetry

Production emits one structured access event for each request to a Book of Mormon
content host. This is observation only: the telemetry pipeline does not allow, deny,
challenge, throttle, or reroute clients.

## Data flow and retention

```text
Cloudflare -> ALB/ACM -> Nginx Proxy Manager -> Next/CRA/backend
                         |                          |
                         | JSON access event       | response classification
                         v                          v
                       Vector ----------------> VictoriaLogs (7 days)
```

NPM writes `/data/logs/bom-telemetry.log`. Host logrotate retains seven daily files;
VictoriaLogs is independently configured with `-retentionPeriod=7d`. Events contain
the path but not its query string, plus timing, status, response mode, user agent,
Cloudflare country/Ray ID, ingress classification, and addressing fields. Cookies,
authorization, request bodies, query strings, and referrers are never written.

The `client_ip` field is derived only from the chain that actually reached NPM:

- `cloudflare`: NPM peer is private (the ALB), the rightmost X-Forwarded-For hop is in
  Cloudflare's published ranges, and `CF-Connecting-IP` is used.
- `direct_alb`: NPM peer is private, but the ALB source is not Cloudflare; the ALB's
  appended source address is used.
- `direct_ec2`: NPM was reached directly; the original socket peer address is used.

The original address fields remain available for seven days so the derivation can be
audited. Cloudflare ranges are pinned in `ops/telemetry/npm-http-top.conf`; compare them
periodically with `https://api.cloudflare.com/client/v4/ips` before updating.

## Response classifications

The Next front door emits public diagnostic response headers:

| Header | Values | Meaning |
|---|---|---|
| `X-BOM-Render-Mode` | `ssr`, `cra`, `asset`, `analytics` | Handler that produced the response |
| `X-BOM-Client-Class` | `browser`, `known-crawler`, `unknown` | Routing classification, not an identity or trust claim |
| `X-Resolved-Lang` | internal language code | Host-derived SSR language, when applicable |

Unknown clients intentionally receive SSR. The crawler-family field in VictoriaLogs is
a reporting convenience derived from UA text; it must not be treated as authenticated.

## Inspect production

VictoriaLogs stays bound to localhost. Create a tunnel, then open the query UI:

```sh
ssh -L 9428:127.0.0.1:9428 bom
```

Open `http://127.0.0.1:9428/select/vmui/` and start with:

```text
_stream:{source_type="bom_access"}
```

Useful filters:

```text
_stream:{source_type="bom_access"} AND render_mode:="ssr"
_stream:{source_type="bom_access"} AND client_class:="unknown"
_stream:{source_type="bom_access"} AND crawler_family:="google"
_stream:{source_type="bom_access"} AND status:>=500
_stream:{source_type="bom_access"} AND request_time:>2
_stream:{source_type="bom_access"} AND ingress:!="cloudflare"
```

For a live request, correlate the response's `CF-Ray` header with `cf_ray` in the log.
The normal acceptance matrix is: Chrome navigation=`cra/browser`, Googlebot=
`ssr/known-crawler`, and an unrecognized indexer=`ssr/unknown`.

## Deploy or recover the collector

The source-controlled production inputs are under `ops/telemetry/`:

- `npm-http-top.conf` -> NPM `/data/nginx/custom/http_top.conf`
- `npm-server-proxy.conf` -> NPM `/data/nginx/custom/server_proxy.conf`
- `vector.yaml` -> `/home/ubuntu/observability/vector.yaml`
- `bom-telemetry.logrotate` -> host `/etc/logrotate.d/bom-telemetry`

The Vector container additionally mounts the NPM log directory read-only at
`/var/log/npm` and a persistent `./vector-data` directory at `/var/lib/vector`. Validate
before reload with `nginx -t` inside NPM and `vector validate` against the candidate
configuration. A collector outage does not interrupt web traffic; repair Vector and it
resumes from its persisted file checkpoint.

## Future enforcement gate

Do not create crawler blocks from UA strings or isolated requests. Collect at least
seven days, then review request rate, status distribution, SSR latency, paths, ingress,
and crawler family. Any later control should be a narrow, reversible Cloudflare rule
based on demonstrated abusive behavior, with verified major crawlers and social preview
agents tested before activation.
