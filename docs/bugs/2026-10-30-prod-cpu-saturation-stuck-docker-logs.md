# Prod 100% CPU for a week — orphaned `docker logs` readers spinning dockerd

**Date:** 2026-10-30 · **Status:** fixed live; hardening below

## Symptom
"Prod keeps crashing". Pages took 8+ s, intermittent 429/502. No container actually
restarted (green: 0 restarts, no OOM, PM2 0 restarts, host up 62 d). EC2
`CPUUtilization` ramped from ~22 % (to Oct 19) to ~70 % (Oct 20–22) to a flat 100 %
from Oct 23; the t3a.medium is in `unlimited` credit mode, so it never throttled — it
stayed slow and accrued surplus-credit charges (~8/h).

## Root cause
Three orphaned CLI processes `docker logs --tail N vector` (7–10 days old, left by
earlier SSH debugging sessions) each held a hot `pread64` loop in `dockerd` on vector's
`json.log` (~5k reads/s each). `dockerd` sat at 140–180 % CPU on a 2-vCPU host; app
processes were starved (CPU PSI `some` avg10 ≈ 69 %).

Ruled out by experiment: cAdvisor (stopped, no change), vector itself (stopped, no
change), app log volume (43 KB/min), exec/health-check churn, crawler traffic as the
primary cause.

## Fix / evidence
`pkill -f '^docker logs --tail [0-9]+ vector$'` → dockerd 143 % → 1 %, load 5.7 → 2.2,
homepage 8.4 s → 0.25 s.

## Diagnosis recipe (reuse)
1. `top` / `systemd-cgtop`: is `docker.service` the CPU hog?
2. `sudo strace -f -e trace=pread64 -p $(pgrep -x dockerd)` then
   `sudo readlink /proc/$(pgrep -x dockerd)/fd/<N>` → which file/container.
3. `ps -eo pid,etime,args | grep 'docker logs'` → kill stale readers.
Never leave `docker logs` un-`timeout`ed or with `-f` over SSH.

## Hardening shipped
- `ops/aws/cloudwatch-cpu-alarm.sh` → alarm `bom-production-cpu-sustained`
  (EC2 CPU ≥ 90 % for 6×5 min → `bom-production-alerts`). Applied to prod 2026-10-30.
- Host `vm.swappiness` 60 → 10 (`/etc/sysctl.d/99-bom-swappiness.conf`, applied live):
  mysqld held ~1.1 GB in swap while 1.7 GB of page cache sat resident.
- `deploy-blue-green.sh`: `docker run --init` — PM2 runtime is PID 1 and did not reap
  `timeout`/`sh`/`grep` orphans (152 zombies after 5 days). **Takes effect on next deploy.**

## Still open
- Root disk alarm is firing (80 %).
- RAM is tight on 3.8 GB (backend ~450 MB, next ~460 MB, mysqld x2, monitoring stack);
  cold-page GraphQL (`page`/`pageprogress`, the person/place/matter bootstrap query)
  takes 1–4 s DB-bound. Consider a larger instance or trimming the monitoring stack.
- SSR responses are `Cache-Control: private, no-cache`; caching crawler HTML at the edge
  would cut load but interacts with the UA-gating design — needs a deliberate decision.

## Cost impact (Oct 2026 bill $138.05 vs Sept $96.64)
- `CPUCredits:t3a` **$19.42** — surplus credits from the 100 % CPU spin (Oct 20–30) on an
  `unlimited`-mode instance. Instance switched to `standard` 2026-10-30; it can no longer
  accrue surplus charges (worst case is throttling to baseline, covered by the CPU alarm).
- CloudFront `Invalidations` **$18.88** — NOT BoM Online and NOT automated. CloudTrail:
  562 `CreateInvalidation` calls / 4,775 paths, Oct 2–7 (peak Oct 6–7), all manual `aws-cli`
  runs under the `OfficeAWS` admin credential. 436 of the 437 calls in Oct 2–8 targeted the
  distribution fronting `media.crawfordgates.com` (a separate composer site in the same AWS
  account: sheet-music PDFs, audio, album art, waveforms, video); only 1 touched BoM's
  distribution (a profile image). The account-wide bill hides which project spent it.
  First 1,000 paths/month are free, then $0.005 each. **Rule:** bulk invalidations use one
  prefix wildcard (`/sheetmusic/*` = 1 path) or versioned keys, never a per-file loop.
- Budget `bom-monthly-cap` ($105/mo; alerts at 60/80/100 % actual + 100 % forecast to the
  `bom-production-alerts` SNS topic) created 2026-10-30. AWS has no native hard cap; an
  auto-stop budget action would take prod down, so it is a deliberate owner decision.
