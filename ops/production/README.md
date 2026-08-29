# Production blue/green deployment

The stable Nginx gateway container owns the exact Docker name
`bookofmormon-online`, so Nginx Proxy Manager keeps its existing upstream.
Only one application slot runs at steady state. The deployment timer pulls the
`:prod` image every five minutes, starts the inactive slot, waits for the image
healthcheck, gracefully reloads the gateway, verifies ports 8200 and 5005, and
then drains the old slot.

Install paths on the production host:

- `/home/ubuntu/greenfield/deploy-blue-green.sh`
- `/home/ubuntu/greenfield/migrate-blue-green.sh` (one-time initial cutover)
- `/home/ubuntu/greenfield/rollback-blue-green.sh`
- `/usr/local/sbin/bom-publish-host-metrics` (root-owned; it reads the
  root-owned NPM telemetry log)
- `/home/ubuntu/greenfield/gateway/default.conf.template`
- `/etc/systemd/system/bom-deploy.service`
- `/etc/systemd/system/bom-deploy.timer`
- `/etc/systemd/system/bom-host-metrics.service`
- `/etc/systemd/system/bom-host-metrics.timer`

Watchtower must not manage the gateway or either app slot. They carry an
explicit `com.centurylinklabs.watchtower.enable=false` label. The systemd timer
is the sole production-image updater.

For the initial cutover, install the new gateway-only `docker-compose.yml` and
all scripts/config first, then run `migrate-blue-green.sh`. It starts and health
checks the blue slot before touching the current container. It renames the
current app to the green rollback slot, starts the gateway under the original
`bookofmormon-online` name, verifies both upstreams, and only then reloads NPM.
NPM's old workers retain the legacy container IP throughout the name handoff.
Any failure before commit restores the original container name and reloads NPM.
Enable `bom-deploy.timer` only after that migration succeeds.

Useful commands:

```sh
sudo systemctl start bom-deploy.service
sudo journalctl -u bom-deploy.service -n 100 --no-pager
sudo systemctl list-timers bom-deploy.timer
sudo /home/ubuntu/greenfield/rollback-blue-green.sh
```

The host metrics timer publishes Next memory, PM2 restart deltas, NPM 5xx,
Vector health, non-Cloudflare ingress, root-disk use, and telemetry size/growth
to `BOM/Production`. The EC2 role needs only the namespace-scoped policy in
`ops/aws/bom-host-metrics-policy.json`.
