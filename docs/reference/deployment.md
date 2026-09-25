# Production deployment & runbook

How prod ships and how to operate it. Evergreen — update in place.
(Redaction: no account/instance IDs, ARNs, or secret values here — those live in the
private `BoMOnlineWorkspace` repo. This repo is public.)

## Architecture

Prod is one **greenfield Docker image** (`kckern/bookofmormon-online`) running backend
(Fastify GraphQL, `:5005`), Next SSR (`:8200`), and the CRA (`:8201`) under pm2, on a
single EC2 host. Fronted by NPM (nginx-proxy-manager) → ALB → Cloudflare. Deploys are
**blue-green** (two slots: `bookofmormon-online-blue` / `-green`); the inactive slot is
kept stopped for one-command rollback.

## How a deploy happens (audit H2/H3/H4)

1. **Trigger:** push to the `prod` branch (branch-protected: PR + the `build` status
   check required, force-push blocked) or a manual `workflow_dispatch`.
2. **`build-push` job** (GitHub-hosted runner):
   - builds the image, pushes `:prod` **and** the immutable `:prod-<sha>`,
   - **cosign-signs the image digest** (key from GH Actions secret; public key at
     `ops/production/cosign.pub`).
3. **`deploy` job** (GitHub-hosted runner — **no self-hosted runner on prod**):
   - assumes a **scoped GitHub-OIDC role** (no stored AWS keys; trust locked to the
     `prod` branch; may only `ssm:SendCommand` the one instance + the deploy document),
   - triggers the deploy on the box via **AWS SSM Run Command** (`bom-deploy` document),
     passing the pinned **image digest** + the deploy script.
4. **On the box** (`deploy-blue-green.sh`, run via SSM):
   - renders `.env` + `mail.env` from **AWS Secrets Manager** (`bom/prod/{db,openai,app,mail}`)
     via the instance role, plus non-secret flags,
   - **`cosign verify`** the pinned digest against `cosign.pub` — **fail-closed** (refuses
     to deploy an unsigned/tampered image),
   - pulls the image **by digest** (not the mutable tag), health-gates the new slot,
     switches the gateway, drains + retains the old slot for rollback.

**No inbound SSH port, no CI runner on the prod host, no long-lived AWS keys.** A 5-minute
systemd timer (`bom-deploy.timer`) reconciles the box to the recorded digest (`desired-image`).

## Common operations

- **Deploy:** merge to `prod` (PR must pass `build`), or run the `deploy-prod` workflow.
- **Change a prod secret:** update the value in **AWS Secrets Manager** (`bom/prod/*`);
  the next deploy renders it into `.env`. Do **not** hand-edit `.env` on the box (it's
  regenerated every deploy).
- **Rollback:** `ops/production/rollback-blue-green.sh` on the box (swaps back to the
  retained stopped slot).
- **Ingest one-offs** (`ingest-group-covers`, `ingest-*-bot-avatars`): manual
  `workflow_dispatch`; **dispatch from the `prod` branch** (the OIDC role trust is
  prod-locked). They run hosted → OIDC → SSM (`bom-ingest`), which clones the repo on the
  box and runs the ingest in the active container.

## Monitoring / alerts (SNS `bom-production-alerts` → email)

- **Deploy failure:** `deploy-blue-green.sh` emits a `DeployFailed` CloudWatch metric;
  alarm `bom-production-deploy-failed` pages on failure (deploys used to fail silently).
- **NPM 5xx burst:** alarm `bom-production-npm-5xx-burst` (2 consecutive breaching 5-min
  buckets). See `docs/bugs/2026-09-08-npm-5xx-burst-ssr-econnrefused.md`.
- Host metrics (`publish-host-metrics.sh`, systemd timer): Next memory, PM2 restarts,
  disk %, telemetry growth, non-Cloudflare ingress.

## Guarantees in place

- Broken builds can't reach prod (branch-protection `build` gate) and can't deploy
  (`build-push` must pass before `deploy` runs).
- Only signed, digest-pinned images run (cosign verify, fail-closed).
- Runtime secrets never live in the repo or in GitHub build args (SM-rendered at deploy).
- CI has no foothold on the prod host (hosted runners + IAM-scoped SSM).

## Disk pressure and container logs

The EC2 root is 34 GB and runs ~16 containers (the greenfield app slots plus the
BoMDocker stack). Two deploys failed on 2026-09-24 with `disk remains 90% full
after emergency prune; refusing image pull`. Worth knowing why:

- **Image pruning cannot rescue this box.** `docker system df` reports every
  image as ACTIVE (15 of 15), because something is running from each one, so
  `docker system prune -a` frees essentially nothing however much it claims is
  "reclaimable". The emergency guard in `deploy-blue-green.sh` now truncates
  oversized container logs *before* it reaches for image pruning, and only gives
  up the rollback slot after that (`BOM_LOG_TRUNCATE_MB`, default 50).
- **pm2 wrote unrotated log files.** `pm2-logrotate` is a pm2 *module* and
  modules do not start under `pm2-runtime`, so nothing rotated them:
  `next-out.log` reached 0.6 GB and `backend-out.log` 0.4 GB in two weeks.
  `ecosystem.config.cjs` now sends pm2 output to `/dev/null`; pm2-runtime still
  forwards every line to container stdout, which is what Vector's `docker_logs`
  source ships to VictoriaLogs, so nothing is lost.
- **Docker's json-file driver does not rotate by default.** The app and gateway
  containers now get `--log-opt max-size=20m --log-opt max-file=3` explicitly
  from the deploy script.

### Daemon-wide log cap: DONE 2026-09-25

`/etc/docker/daemon.json` is `json-file` with `max-size: 20m`, `max-file: 3`
(backup alongside it as `daemon.json.bak-<date>`), and it is **in effect** — a
container created after the restart inherits those values. Applying it required
`systemctl restart docker`, because `log-driver`/`log-opts` are NOT part of
Docker's live-reload set: after a SIGHUP reload a new container still inherited
the old `100m`.

Note that Docker bakes the *resolved* default into a container's `HostConfig`
at creation time, so containers created before this keep `100m` (or nothing at
all, for the oldest ones) until they are next recreated. The deploy guard's log
truncation remains the safety net for those.

**Restarting the daemon drops `vector`.** It exits 137: it retries against
`victorialogs` (also restarting, so refusing connections), does not finish
shutting down inside the grace period, gets SIGKILLed, and `unless-stopped`
then treats it as deliberately stopped and leaves it down. Its policy is now
`always`, which survives a daemon restart. If you restart the daemon again,
still check `docker ps | grep vector` — a dead shipper is silent, and the only
symptom is VictoriaLogs going quiet.

Everything else came back on its own policy. The one container that stays down
by design is the inactive blue-green slot (`policy=no`, exited), which is the
rollback image.

### Known-bad commit: 15a5559d

`15a5559d` ("Fix /map, broken on React 18 by an async useEffect") **cannot
build**. It carries the move of the CRA HTML template out of `public/` without
the `config-overrides.js` change that told react-scripts where the template
went, because `git mv` had staged the rename and a later `git add` of an
unrelated file swept it into the commit. CI caught it (`Name: index.html`).

The next commit, `930fd27f`, repairs the pair, and every commit after it builds.
Nothing was deployed from the broken commit. It is left in history rather than
rewritten because it was already pushed — but a `git bisect` or a revert that
lands exactly there will fail to build, and that is why, not something about
the code at that point.

(Historical note: react-scripts was removed in `b45be4ad`; from there the
frontend builds with Vite and this particular failure mode is gone.)

