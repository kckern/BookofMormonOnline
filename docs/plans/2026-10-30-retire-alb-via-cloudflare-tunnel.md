# Plan: retire the ALB, serve prod through Cloudflare Tunnel

Status: DONE 2026-10-31 (ALB deleted; see the retirement note below). Executed:

- Tunnel `bom` routes added for all 8 Cloudflare zones (apex + wildcard -> `http://proxy:80`); dead `bom-portainer` route and DNS record removed.
- NPM `bom_ingress` label map now reports `tunnel` (backup `http_top.conf.bak-20261030-tunnel`).
- DNS for all 8 zones flipped from the ALB to the tunnel (old values saved in the working session; rollback = point the apex/wildcard CNAME back at the ALB DNS name).
- `cloudflared` pinned to 2026.10.6 in `/home/ubuntu/cloudflared/docker-compose.yml` (was `:latest`).
- Elastic IP attached to the prod instance (origin for CloudFront); Infisical `HOST` updated to the new public DNS name.
- `.kr`: ACM cert issued in us-east-1 (DNS-validated, auto-renewing); CloudFront distribution created (caching disabled, AllViewer origin request policy, origin = EC2 EIP DNS name over HTTP:80). DNS cutover of the `.kr` apex/wildcard from the ALB to CloudFront is the next step.
- `.рф` is sanctioned: out of scope, left untouched.

**ALB RETIRED 2026-10-31.** KC chose to move the other products (including Scripture Guide) and ignore `.рф`.

- `archival.link`, `netlab.cloud` and `scripture.guide` now run on CloudFront (free ACM certs in us-east-1, DNS-validated; Route 53 alias A+AAAA; CachingDisabled + AllViewer; origin = EC2 Elastic IP over HTTP:80), the same recipe as `.kr`. Responses were compared byte-for-byte against the ALB before each DNS flip.
- `scripture.guide`: another distribution already holds the alias `*.scripture.guide` (S3 assets), so the new distribution lists explicit aliases (apex, www, cover, meta, w-ww, ww-w, plain, api, next), the hosts seen in logs. The wildcard DNS CNAME was deleted: other subdomains now return NXDOMAIN (the rest was scanner noise).
- `o-7799a14bc906.netlab.cloud` (Sendy open-tracking host) moved too. The ALB's `X-Origin-Verify` 403 gate for it is gone; the host serves Sendy like `mail.netlab.cloud` already did.
- ALB traffic fell from about 100 to under 25 requests per 5 minutes after the flips (health checks and internal pings), then the ALB, both listeners and all three target groups were deleted. Config dump for recreation stays in the working session.
- Also deleted: 9 ALB ACM certs in us-west-2, the legacy SG `bom_security` (world-open 80/443) with the instance's reference to it, `bom-alb-cloudflare`, `bom-origin-alb`. Three AWS-managed expired/foreign certs remain in use by AWS-internal load balancers and cannot be deleted.
- The box now takes web traffic only from the CloudFront prefix list on :80 (`bom-origin-cloudfront`) and the Cloudflare tunnel (outbound).
- `.рф` (sanctioned, out of scope) still has a Route 53 record at the deleted ALB name: it is dark.
- Stale Route 53 zones for the 8 BoM domains still hold ALB records but are not authoritative (Cloudflare is); they can be deleted ($0.50/month each).
- Cloudflare: a scoped API token (Tunnel Write on the account, DNS Write on the 9 zones) was created and stored in prod Infisical as `CLOUDFLARE_API_TOKEN`; verified with tunnel and DNS reads. The Global key is still in Infisical (`CLOUDFLARE_KEY`/`CLOUDFLARE_EMAIL`) until KC rolls it in the dashboard.

Original plan follows (savings figures below are measured, see table).

## Why, and what it actually saves

Measured from Cost Explorer, Oct 1-30 2026 (not estimates):

| Line | Oct to date | Goes away? |
|---|---|---|
| ALB hours (`LoadBalancerUsage`) | $15.75 | yes |
| ALB LCUs | $1.68 | yes |
| Public IPv4, in use (4 addresses: 3 ALB ENIs + 1 EC2) | $11.96 | 3 of 4 (~$9) |
| WAF | $0 | nothing to remove: no regional web ACL exists |
| Data transfer out | $12.45 | no (EC2 still egresses through the tunnel) |

Realistic saving: about **$26-27/month**, not the $45-50 I quoted earlier. That earlier figure assumed a WAF charge that does not exist. New spend: $0 (tunnel is free).

## What is already in place (found read-only 2026-10-30)

- ALB `Gateway-LoadBalancer`: listeners 80 (forward) and 443 (forward), target groups `EC2BoMDocker` (:80, health `/`) and `BoMOnline-Test-TargetGroup` (:80, health `/`; test leftover, evaluate for deletion).
- A `cloudflared` container (remote-managed, `tunnel run`) has been up 7 days and is connected (sea01, QUIC). Its hostname/route table lives in the Cloudflare dashboard and is NOT visible from here. It is outdated (2026.10.2 vs 2026.10.6) and uses the `:latest` tag.
- `ops/aws/cloudflare-ingress/README.md` stages security groups that lock the ALB to Cloudflare IPs. That is a different (and now unnecessary) path if the ALB is retired; do not attach them.

## Unknowns that must be resolved first (read-only)

1. Which hostnames the existing tunnel already routes, and to which origin (likely Scripture Guide, not BoM). Needs Cloudflare dashboard or an API token; we have neither in Infisical as far as checked.
2. Which hostnames still resolve to the ALB and whether any bypass Cloudflare (earlier sample: 217 of 3,000 requests arrived directly).
3. The Korean domain (`xn--289a67xla.kr`): zone active/proxied/Full(strict)? (Gate item 1 in the existing README.)
4. Whether any client depends on the ALB DNS name itself (health checks, webhooks, Sendy, mail links).
5. Whether the ALB's one-time TLS (ACM cert) is used by anything else.

## Findings from the Phase 0 DNS check (2026-10-30)

- 10 of 11 BoM hostnames are on Cloudflare nameservers and can move to the tunnel one at a time.
- `xn--289a67xla.kr` is NOT on Cloudflare: it resolves straight to the ALB's IPs. Its nameservers must move to Cloudflare (registrar action) before the ALB is deleted, or it goes down.
- Cloudflare API access is still unconfirmed; the existing tunnel's routes can't be read from here.

## Phases (each independently reversible)

**Phase 0, prerequisites (no prod change)**
- Answer the unknowns above.
- Pin `cloudflared` to a version instead of `:latest`; update it.
- Add an alarm on tunnel connectivity (tunnel down = site down once the ALB is gone) and a systemd/Docker `restart: always` check.

**Phase 1, add tunnel routes alongside the ALB**
- In Cloudflare, add a public hostname per BoM domain pointing the tunnel at `http://proxy:80` (NPM, same Docker network) with `Host` preserved.
- Do not change DNS yet. Test each hostname via a temporary test hostname on the tunnel (same NPM vhosts, same crawler limits).
- Check: `x-forwarded-host` and client IP reach NPM correctly (the NPM `http_top.conf` currently derives source IP from ALB `X-Forwarded-For`; a tunnel supplies `CF-Connecting-IP` instead, so the real-IP and crawler-classification maps MUST be updated or every request looks like one client and the rate limits break).

**Phase 2, cut DNS over, one hostname at a time**
- Start with a low-traffic language domain. Switch its CNAME to `<tunnel-id>.cfargotunnel.com` (proxied). Verify 200s, crawler 429 behavior, 301 behavior, and telemetry. Keep the ALB serving everything else.
- Order: language domains, then `ssr.`/`img.` hostnames, then the apex last.
- Roll back a hostname by pointing its CNAME back at the ALB.

**Phase 3, observe**
- One week with zero ALB request count (CloudWatch `RequestCount`) before touching AWS.

**Phase 4, retire AWS resources**
- Delete the ALB listeners, then the ALB, then the target groups; release nothing else (the EC2 public IP stays).
- Remove the legacy security-group references only after the rollback window closes.
- Update `docs/reference` / memory `prod_infra_access`, and re-check Cost Explorer next month.

## Risks

- **Single path in.** `cloudflared` becomes the only way to reach the site; a crash is an outage with no ALB fallback. Mitigation: restart policy, alarm, and pinning.
- **Client IP / rate limiting.** Covered in Phase 1; this is the biggest technical hazard.
- **Direct hits that bypass Cloudflare** will stop working after Phase 4 (arguably a benefit).
- **Mail/webhook dependence** on the ALB name (unknown #4).
- **Other products share the box and possibly the tunnel** (Scripture Guide). Do not edit its routes or restart the tunnel without confirming.
- Savings are modest (~$26/month). The migration is worth it only if KC wants the ALB gone for reasons beyond cost (simplicity, one fewer moving part).

## Decision for KC

Proceed with Phase 0 (read-only plus pinning/alarms), or leave the ALB as is given the ~$26/month saving?
