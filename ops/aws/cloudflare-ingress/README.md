# Cloudflare-only production ingress

The replacement security groups are staged but deliberately **not attached**
until every production hostname, including `xn--289a67xla.kr`, is active and
proxied through Cloudflare.

## Staged resources

- ALB: `bom-alb-cloudflare` (`sg-04cceb2bb571eab53`)
  - TCP 80 and 443 from Cloudflare's 15 current IPv4 ranges
  - ranges fetched from `https://api.cloudflare.com/client/v4/ips`
  - source etag observed when staged: `38f79d050aa027e3be3865e495dcc9bc`
- EC2 origin: `bom-origin-alb` (`sg-0fe59ac614527a229`)
  - TCP 80 from `sg-04cceb2bb571eab53`
  - preserved administrator `/32` (`<ADMIN_IP>/32`) on TCP 22, 3306, 6379

The ALB is IPv4-only, so Cloudflare's IPv6 origin ranges do not apply to its
listener. Both staged groups retain the default outbound rule. As staged, they
have no effect: the ALB and EC2 instance both remain attached only to the legacy
shared group `sg-08fecaa54d23d309d`.

## Activation gate

Before attachment, prove all of the following:

1. the `.kr` parent delegates the Korean hostname to Cloudflare;
2. the Cloudflare zone is `active`, proxied, and uses Full (strict);
3. apex, wildcard, PHP routes, GraphQL, CRA, and bot SSR pass through Cloudflare;
4. Cloudflare's current IPv4 list still matches every staged ALB CIDR; and
5. the administrator source `/32` is still correct.

## Safe attachment order

1. Attach `bom-origin-alb` to EC2 **alongside** the legacy group.
2. Attach `bom-alb-cloudflare` to the ALB **alongside** the legacy group.
3. Exercise the full HTTP acceptance set, including PHP routes and ALB target
   health.
4. Remove the legacy group from the ALB. Confirm Cloudflare traffic works and a
   direct non-Cloudflare ALB request is rejected.
5. Remove the legacy group from EC2. Confirm ALB target health plus SSH and the
   explicitly preserved administrator ports.

Rollback at any stage is to reattach `sg-08fecaa54d23d309d` to the affected
resource. Do not delete the legacy group during the DNS or deployment rollback
windows.

Cloudflare can change its published networks. Recompare the official `/ips`
response before attachment and periodically afterward; update this ALB group
before removing any retired ranges.
