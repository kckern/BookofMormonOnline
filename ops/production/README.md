# Production blue/green deployment

The stable `bookofmormon-gateway` container owns the Docker network alias
`bookofmormon-online`, so Nginx Proxy Manager keeps its existing upstream.
Only one application slot runs at steady state. The deployment timer pulls the
`:prod` image every five minutes, starts the inactive slot, waits for the image
healthcheck, gracefully reloads the gateway, verifies ports 8200 and 5005, and
then drains the old slot.

Install paths on the production host:

- `/home/ubuntu/greenfield/deploy-blue-green.sh`
- `/home/ubuntu/greenfield/rollback-blue-green.sh`
- `/home/ubuntu/greenfield/gateway/default.conf.template`
- `/etc/systemd/system/bom-deploy.service`
- `/etc/systemd/system/bom-deploy.timer`

Watchtower must not manage the gateway or either app slot. They carry an
explicit `com.centurylinklabs.watchtower.enable=false` label. The systemd timer
is the sole production-image updater.

Useful commands:

```sh
sudo systemctl start bom-deploy.service
sudo journalctl -u bom-deploy.service -n 100 --no-pager
sudo systemctl list-timers bom-deploy.timer
sudo /home/ubuntu/greenfield/rollback-blue-green.sh
```
