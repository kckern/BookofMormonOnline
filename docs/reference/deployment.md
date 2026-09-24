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
