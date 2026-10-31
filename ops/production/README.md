# Production blue/green deployment

The stable Nginx gateway container owns the exact Docker name
`bookofmormon-online`, so Nginx Proxy Manager keeps its existing upstream.
Only one application slot runs at steady state. Each deployment (CI → SSM
`bom-deploy`, run as root with `BOM_IMAGE=<signed digest>`) pulls and
cosign-verifies the image, starts the inactive slot, waits for the image
healthcheck, gracefully reloads the gateway, verifies ports 8200 and 5005, and
then drains the old slot.

`bom-deploy.timer` is retired (2026-10-31): deploys are CI → SSM only; the timer
redeployed a stale `desired-image` pin.

Runtime config is not read from a secret store or `.env` file. The candidate
bind-mounts the RAM bundle `/run/bom-secrets` read-only at `/run/secrets` (with
`BOM_REQUIRE_SECRETS=1`); the deploy refuses to start a candidate if the bundle
is missing (e.g. after a reboot, until homeserver re-pushes).
`deploy-blue-green.sh --redeploy-active` redeploys the active slot's own image
(re-verified) so a re-pushed bundle takes effect.

Before every pull, routine cleanup removes build cache and images unused for 24
hours. If the filesystem containing `BOM_DEPLOY_DIR` is at least 90% full
(`BOM_EMERGENCY_DISK_PERCENT` overrides the threshold), deployment enters an
emergency path: it removes the stopped inactive rollback slot, runs
`docker system prune -a -f` without pruning volumes, and measures disk usage
again. It refuses to pull if usage remains at or above the threshold. Running
containers—including the active application and gateway—are preserved, but an
emergency prune intentionally forfeits the one-deploy rollback slot.

Install paths on the production host:

- `/home/ubuntu/greenfield/deploy-blue-green.sh`
- `/home/ubuntu/greenfield/migrate-blue-green.sh` (one-time initial cutover)
- `/home/ubuntu/greenfield/rollback-blue-green.sh`
- `/usr/local/sbin/bom-publish-host-metrics` (root-owned; it reads the
  root-owned NPM telemetry log)
- `/home/ubuntu/greenfield/gateway/default.conf.template`
- `/etc/systemd/system/bom-deploy.service` (retired; disabled)
- `/etc/systemd/system/bom-deploy.timer` (retired; disabled)
- `/etc/systemd/system/bom-host-metrics.service`
- `/etc/systemd/system/bom-host-metrics.timer`

Watchtower must not manage the gateway or either app slot. They carry an
explicit `com.centurylinklabs.watchtower.enable=false` label. CI → SSM is the
sole production-image updater.

For the initial cutover, install the new gateway-only `docker-compose.yml` and
all scripts/config first, then run `migrate-blue-green.sh`. It starts and health
checks the blue slot before touching the current container. It renames the
current app to the green rollback slot, starts the gateway under the original
`bookofmormon-online` name, verifies both upstreams, and only then reloads NPM.
NPM's old workers retain the legacy container IP throughout the name handoff.
Any failure before commit restores the original container name and reloads NPM.
After that migration succeeds, routine deploys go through CI → SSM.

Useful commands:

```sh
sudo /home/ubuntu/greenfield/rollback-blue-green.sh
```

The host metrics timer publishes Next memory, PM2 restart deltas, NPM 5xx,
Vector health, non-Cloudflare ingress, root-disk use, and telemetry size/growth
to `BOM/Production`. The EC2 role needs only the namespace-scoped policy in
`ops/aws/bom-host-metrics-policy.json`.
