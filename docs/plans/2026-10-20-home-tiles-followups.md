# Home Tiles Follow-ups (soak, archive image variants, state sweeps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, in-session). **Do not launch Workflow or subagents** for this plan (KC, 2026-10-20: the last review loop cost far too much). Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) verify the 2026-10-20 prod deploy holds up, (2) cut the remaining heavy Home images (art, fax, history, source covers) with resized WebP variants, (3) close the unchecked states (tablet, dark mode, Korean, logged-in).

**Architecture:** All three parts reuse what already exists: `scripts/home-audit/` (Playwright harness, runs against Vite :8201), `backend/scripts/build-media-variants.mjs` + `tiles/_ds/mediaVariants.js` + `TileImage` (variant URL = `variants/<w>/<original key>.webp`, per-image fallback to the original on error), and the audit doc as the record. No new runtime systems.

**Tech Stack:** Node 24 ESM scripts, Playwright (from `frontend/next/node_modules`), `sharp`, `@aws-sdk/client-s3`, Vitest, React 19.

**Spec / context:** `docs/audits/2026-10-15-home-discover-tile-audit.md` (R6 deploy record, "Known, accepted"), `docs/specs/2026-10-15-home-tiles-production-readiness.md`, memory `home_tiles_production_readiness`. Predecessor plan: `docs/plans/2026-10-15-home-tiles-production-readiness.md` (Tasks 11–12 built the variant pipeline).

## Global Constraints

- **No Workflow, no subagents, no `model: "fable"`.** Everything runs inline. Budget for the whole plan: well under 2M tokens; stop and ask KC before exceeding.
- **KC confirms before each outward action, at that moment:** prod S3 upload (Task 6), prod SSH/log access (Task 2, read-only), prod DB label writes (Task 9), pushing `dev`/`prod` (Task 8).
- **Prod access is read-only except the S3 upload:** never `compose up`, restart, or edit anything on the prod box.
- Never print secret values. Fetch-and-consume in one chain (`scripts/with-prod-secrets.sh`, Task 1); key material only under `$XDG_RUNTIME_DIR` mode 600.
- Public repo: never commit screenshots (`docs/audits/home-discover-audit-2026-10-15/` is gitignored), real user content, internal IPs/hostnames, or bucket/instance IDs. `S3_BUCKET` comes from env only.
- Audit target is Vite `http://localhost:8201` (not Next :8200). Tests: `cd frontend/webapp && npx vitest run <path>`; the whole suite must stay green (baseline 256 files, 2,250 passed, 6 skipped).
- Variants never replace originals: every `TileImage` keeps `src=<original>`; a missing variant must fall back, not break (existing `onError` behavior).
- House style unchanged: links black, neutral gray, gold `#c9a24b` the only accent, no blue.

## Review Focus

1. **A variant is missing or 404s for one image** → the tile must still show the original (no broken image, no blank). Pinned by Task 4's fallback test.
2. **Keys with extensions and nested paths** (`fax/thumb/1830/010.jpg`, `history/fax/0120.001.jpg`, `art/1039` with no extension) must map to distinct variant keys and round-trip between script and frontend. Pinned by Task 3's shared-mapping test (script) and Task 4's URL test (frontend).
3. **Images already small (< 256px) or portrait/transparent PNG:** no upscaling, alpha preserved. Pinned by Task 3's `plan()` test and the dry-run spot check in Task 5.
4. **Korean/other-language hosts** show hardcoded English strings or overflow. Pinned by Task 10's static scan and Task 11's host-mapped run.
5. **Dark mode / tablet:** text on images or gray surfaces below contrast, overflow at 820px. Pinned by Task 10's `sweep-states` metrics.

---

## Part A — Soak the deploy (Tasks 1–2)

### Task 1: Prod-secrets helper and the repo smoke script

**Files:**
- Create: `scripts/with-prod-secrets.sh`
- Create: `scripts/home-audit/prod-smoke.mjs`
- Modify: `scripts/home-audit/README.md` (add both)

**Interfaces:**
- Produces: `with-prod-secrets.sh <KEY[,KEY…]|aws|ssh> -- <command…>`. For `aws` it exports `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-west-2` and `S3_BUCKET` (from Secrets Manager `bom/prod/app`); for `ssh` it exports `PROD_HOST` and `PROD_KEY_FILE` (key written 0600 under `$XDG_RUNTIME_DIR`). It prints nothing secret.
- Produces: `prod-smoke.mjs` (`BASE` default `https://bookofmormon.online`) exiting non-zero on any failed check.

- [ ] **Step 0: One-time local setup (not committed).** Create `/home/bom/infisical/.prod-project-id` (mode 600) containing the prod Infisical project id from memory note `prod-infra-access`. It lives beside the machine-identity files and never enters the repo.

- [ ] **Step 1: Write the helper**

```bash
#!/usr/bin/env bash
# Run a command with prod credentials from local Infisical; nothing is printed.
# usage: with-prod-secrets.sh aws|ssh -- cmd args…
set -euo pipefail
MODE="${1:?usage: with-prod-secrets.sh aws|ssh -- cmd…}"; shift
[ "${1:-}" = "--" ] && shift
ID_DIR=/home/bom/infisical
CID="$(<"$ID_DIR/.client-id")"; CSEC="$(<"$ID_DIR/.client-secret")"
PID="$(<"$ID_DIR/.prod-project-id")"   # local file, outside the repo (public repo: no infra IDs in commits)
TOKEN="$(jq -n --arg a "$CID" --arg b "$CSEC" '{clientId:$a,clientSecret:$b}' \
  | curl -fsS -X POST http://127.0.0.1:8070/api/v1/auth/universal-auth/login -H 'Content-Type: application/json' --data-binary @- | jq -er .accessToken)"
SECRETS="$(printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" \
  | curl -fsS -K - "http://127.0.0.1:8070/api/v3/secrets/raw?environment=prod&secretPath=%2F&workspaceId=$PID")"  # pragma: allowlist secret
get() { jq -er --arg k "$1" '.secrets[]|select(.secretKey==$k).secretValue' <<<"$SECRETS"; }
unset TOKEN CSEC
case "$MODE" in
  aws)
    export AWS_ACCESS_KEY_ID="$(get AWS_KEY)" AWS_SECRET_ACCESS_KEY="$(get AWS_SECRET)" AWS_REGION=us-west-2 AWS_DEFAULT_REGION=us-west-2
    APP="$(~/.local/bin/aws secretsmanager get-secret-value --secret-id bom/prod/app --query SecretString --output text)"
    export S3_BUCKET="$(jq -er .S3_BUCKET <<<"$APP")"; unset APP ;;
  ssh)
    export PROD_HOST="$(get HOST)"
    export PROD_KEY_FILE="$XDG_RUNTIME_DIR/prod_key"
    umask 077; get SSH > "$PROD_KEY_FILE"; chmod 600 "$PROD_KEY_FILE" ;;
  *) echo "mode must be aws or ssh" >&2; exit 2 ;;
esac
unset SECRETS
exec "$@"
```

- [ ] **Step 2: Promote the smoke test into the repo.** Create `scripts/home-audit/prod-smoke.mjs` with the body of the 15-check prod smoke used on 2026-10-20: for `desktop` and `phone` contexts (Playwright imported as in `verify-back.mjs`, `serviceWorkers: "block"`, real browser UAs), load `${BASE}/home`; assert tile count ≥ 15; on phone assert `.samplerSingle` exists and `.tile-people` top < 900; assert layout-shift sum < 0.1; assert ≥ 1 `/variants/` response and none ≥ 400; click the first visible `/people/` or `/places/` tile link, wait 4 s, `goBack`, assert the URL returns to `/home`; load `/home/user` and assert `#root` has children and `innerText.length > 100`; load `/matters/narrative` and assert the text does not match `/not found/i` and more than 20 `a[href^='/matters/']` exist; assert no `pageerror`. Print `ok`/`FAIL` per check; `process.exit(failed ? 1 : 0)`.

- [ ] **Step 3: Run it** — `node scripts/home-audit/prod-smoke.mjs`. Expected: `all prod smoke checks passed`.

- [ ] **Step 4: Update `scripts/home-audit/README.md`** with one table row each, then commit:

```bash
git add scripts/with-prod-secrets.sh scripts/home-audit
git commit -m "chore(home-audit): prod-secrets helper + repo prod smoke script

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Read-only soak check (now, then +24 h)

**Files:**
- Create: `scripts/home-audit/prod-soak.sh`
- Modify: `docs/audits/2026-10-15-home-discover-tile-audit.md` (append "R7. Soak")

- [ ] **Step 1: Ask KC** for a go on read-only prod log access (SSH, `docker exec … cat`, `docker logs`), then write the script:

```bash
#!/usr/bin/env bash
# Read-only prod soak summary. Run via: scripts/with-prod-secrets.sh ssh -- scripts/home-audit/prod-soak.sh [hours]
set -euo pipefail
H="${1:-24}"
SSH=(ssh -i "$PROD_KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "ubuntu@$PROD_HOST")
echo "== NPM telemetry, last ${H}h: status histogram, 5xx by uri/render_mode"
"${SSH[@]}" "docker exec proxy cat /data/logs/bom-telemetry.log" | jq -rs --argjson h "$H" '
  map(select((.time // .ts // 0) != 0)) as $all
  | ($all | length) as $n
  | {requests: $n,
     by_status: ($all | group_by(.status) | map({(.[0].status|tostring): length}) | add),
     fivexx: ($all | map(select(.status >= 500)) | group_by([.status,.uri,.render_mode]) | map({k: .[0] | [.status,.uri,.render_mode], n: length}) | sort_by(-.n) | .[0:10])}' || echo "(telemetry format differs; inspect manually)"
echo "== active app container error lines, last ${H}h"
"${SSH[@]}" 'A=$(sed -n 1p /home/ubuntu/greenfield/active-slot); docker logs --since '"${H}"'h "$A" 2>&1 | grep -E -i "error|ECONNREFUSED|unhandled|fatal" | sed -E "s/[0-9a-f]{8}-[0-9a-f-]{27}/<id>/g" | sort | uniq -c | sort -rn | head -15'
echo "== container health"
"${SSH[@]}" 'docker ps --format "{{.Names}} {{.Status}}" | grep -E "bookofmormon-online|proxy"'
```

- [ ] **Step 2: Run it** — `scripts/with-prod-secrets.sh ssh -- scripts/home-audit/prod-soak.sh 24` and `node scripts/home-audit/prod-smoke.mjs`. If the telemetry `jq` shape is wrong, read one raw line (`head -c 600`, no secrets in it) and adjust the field names once.
- [ ] **Step 3: Triage.** Expected: 5xx only from scanner probes (`/.env*`, `/actuator/*`) or `ECONNREFUSED` during a PM2 recycle (see memory `npm-5xx-ssr-econnrefused`). Any 5xx on `/home`, `/graphql`, `/people/*`, `/places/*`, `/matters/*`, or a new error signature is a finding: reproduce on dev, fix with a test, and add to the follow-up list.
- [ ] **Step 4: Record** one paragraph under `## R7. Soak` in the audit doc (time window, request count, 5xx summary, smoke result), commit. Re-run Steps 2–4 about 24 h later and append the second reading.

```bash
git add scripts/home-audit/prod-soak.sh docs/audits/2026-10-15-home-discover-tile-audit.md
git commit -m "docs(audits): R7 prod soak readings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Part B — Variants for art, fax, history and source covers (Tasks 3–8)

Measured on 2026-10-20 (desktop, deep scroll): art 1.2 MB, fax 2.3 MB, history 1.9 MB, source covers 1.05 MB, home banners 0.24 MB. Tiles read: `art/<id>`, `fax/thumb/<slug>/<nnn>.<ext>`, `fax/covers/<slug>`, `history/thumbs/<id4>`, `history/fax/<id4>.<nnn>.jpg`, `source/cover/<nnn>`. (`fax/pages/*` are viewer images, not tile images: excluded.)

### Task 3: Shared key mapping + enumeration in the script (TDD)

**Files:**
- Create: `backend/scripts/lib/mediaVariantKeys.mjs`
- Test: `backend/test/scripts/mediaVariantKeys.test.ts`
- Modify: `backend/scripts/build-media-variants.mjs`

**Interfaces:**
- Produces: `FAMILIES` (array of `{ name, prefix, widths }`), `variantKey(width, originalKey): string`, `plan(listedKeys, existingVariantKeys): {key, widths}[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FAMILIES, variantKey, plan } from '../../scripts/lib/mediaVariantKeys.mjs';

describe('variantKey', () => {
  it('keeps the original key (incl. extension) so keys never collide', () => {
    expect(variantKey(256, 'fax/thumb/1830/010.jpg')).toBe('variants/256/fax/thumb/1830/010.jpg.webp');
    expect(variantKey(256, 'art/1039')).toBe('variants/256/art/1039.webp');
    expect(variantKey(640, 'history/fax/0120.001.jpg')).toBe('variants/640/history/fax/0120.001.jpg.webp');
  });
});

describe('plan', () => {
  const listed = ['art/1', 'art/2', 'fax/pages/1830/010.jpg', 'fax/thumb/1830/010.jpg', 'history/thumbs/0120', 'people/nephi1', 'art/'];
  it('keeps only tile families, never fax/pages or already-done families', () => {
    const keys = plan(listed, new Set()).map((p) => p.key);
    expect(keys).toEqual(['art/1', 'art/2', 'fax/thumb/1830/010.jpg', 'history/thumbs/0120']);
  });
  it('skips keys whose every variant already exists (idempotent)', () => {
    const have = new Set([variantKey(256, 'art/1'), variantKey(640, 'art/1')]);
    expect(plan(listed, have).map((p) => p.key)).not.toContain('art/1');
  });
  it('uses the family widths', () => {
    const art = plan(['art/9'], new Set())[0];
    expect(art.widths).toEqual(FAMILIES.find((f) => f.name === 'art').widths);
  });
});
```

- [ ] **Step 2: Run** — `cd backend && npx vitest run test/scripts/mediaVariantKeys.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```js
// backend/scripts/lib/mediaVariantKeys.mjs
// Which original media keys get resized variants, and where the variants live.
// The frontend mirrors this in tiles/_ds/mediaVariants.js (variantUrl + VARIANT_FAMILIES).
export const FAMILIES = [
  { name: 'art', prefix: 'art/', widths: [256, 640] },
  { name: 'history-thumbs', prefix: 'history/thumbs/', widths: [256, 640] },
  { name: 'history-fax', prefix: 'history/fax/', widths: [256, 640] },
  { name: 'fax-thumb', prefix: 'fax/thumb/', widths: [256, 640] },
  { name: 'fax-covers', prefix: 'fax/covers/', widths: [256, 640] },
  { name: 'source-cover', prefix: 'source/cover/', widths: [256] },
];

export const variantKey = (width, originalKey) => `variants/${width}/${originalKey}.webp`;

/** listedKeys: every key under the family prefixes. existing: Set of variant keys already in S3. */
export function plan(listedKeys, existing) {
  const out = [];
  for (const key of listedKeys) {
    const fam = FAMILIES.find((f) => key.startsWith(f.prefix) && key.length > f.prefix.length && !key.endsWith('/'));
    if (!fam) continue;
    const missing = fam.widths.filter((w) => !existing.has(variantKey(w, key)));
    if (missing.length) out.push({ key, family: fam.name, widths: fam.widths, missing });
  }
  return out;
}
```

- [ ] **Step 4: Run** — expected PASS (3 tests).

- [ ] **Step 5: Wire into `build-media-variants.mjs`.** Add `--families art,fax-thumb,…` (default none → existing people/places/matters behavior unchanged). For each selected family: `ListObjectsV2` on `Bucket: S3_BUCKET, Prefix: fam.prefix` (paginate with `ContinuationToken`) to get `listedKeys`; list `variants/` once per width prefix to build `existing`; call `plan(...)`; for each planned key download `https://media.bookofmormon.online/<key>`, resize with `sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 72, alphaQuality: 80 })`, write to `--out` or `PutObject` at `variantKey(width, key)` with `ContentType: image/webp`, `CacheControl: public, max-age=31536000, immutable`. Listing needs the AWS credentials, so a dry run with `--out` also requires `with-prod-secrets.sh aws`; add `--list-only` that prints per-family counts and total original bytes (from `Size` in the listing) and exits.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts backend/test/scripts
git commit -m "feat(media): variant key mapping + S3 enumeration for art/fax/history/source

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: Frontend families + tile opt-outs (TDD)

**Files:**
- Modify: `frontend/webapp/src/views/Home/tiles/_ds/mediaVariants.js`
- Modify: `ImageArtTile.js:116`, `NarrationTile.js:113`, `CommentaryTile.js:246`, `NotesTile.js:241`, `ContentsTile.js:55`, `TextTile.js:66` (drop `widths={[]}`, pass a real `sizes`); `FaxTile.js`, `ArchiveDocTile.jsx`, `JosephSmithTile.js`, `WitnessTile.js` where their paths are in the new families
- Test: `tiles/_ds/__tests__/mediaVariants.test.js`, `tiles/__tests__/ImageArtTile.test.js`, `FaxTile.test.js`

**Interfaces:**
- Consumes: `variantUrl(path, width)` (unchanged: `${assetUrl}/variants/${width}/${path}.webp`), `hasVariants(path)`.
- Produces: `VARIANT_FAMILIES` matching exactly the prefixes in `FAMILIES` (Task 3).

- [ ] **Step 1: Failing tests** (append to `mediaVariants.test.js`)

```js
import { hasVariants, variantUrl } from "../mediaVariants";

describe("variant families mirror the generator", () => {
  test.each([
    "people/nephi1", "places/zarahemla", "matters/swords",
    "art/1039", "history/thumbs/0120", "history/fax/0120.001.jpg",
    "fax/thumb/1830/010.jpg", "fax/covers/1830", "source/cover/012",
  ])("%s has variants", (p) => expect(hasVariants(p)).toBe(true));

  test.each(["fax/pages/1830/010.jpg", "home/lehites-1", "profiles/grp_x.jpg", "map/z/1/2", "https://x/y.jpg"])(
    "%s does not", (p) => expect(hasVariants(p)).toBe(false));

  test("variant URLs keep the extension and append .webp", () => {
    expect(variantUrl("fax/thumb/1830/010.jpg", 256)).toMatch(/\/variants\/256\/fax\/thumb\/1830\/010\.jpg\.webp$/);
  });
});
```

Add to `ImageArtTile.test.js`: with `REACT_APP_MEDIA_VARIANTS=1`, the art `<img>` has `srcset` containing `variants/256/art/<id>.webp 256w`; firing `error` on the image removes `srcset` and leaves `src` as the original (Review Focus 1).

- [ ] **Step 2: Run** (`npx vitest run src/views/Home/tiles/_ds src/views/Home/tiles/__tests__/ImageArtTile.test.js`). Expected: FAIL.

- [ ] **Step 3: Implement.** In `mediaVariants.js`:

```js
// Only media families whose variants were generated (backend/scripts/lib/mediaVariantKeys.mjs).
const VARIANT_FAMILIES = /^(people|places|matters|art|history\/(thumbs|fax)|fax\/(thumb|covers)|source\/cover)\//;
```

Remove each `widths={[]}` listed above (the opt-outs existed only because no variants did). Give each image a truthful `sizes` (e.g. art/history/fax tile images: `(max-width: 900px) 92vw, 33vw`; small avatars/covers: their CSS px width). Tiles whose path is absolute or outside the families keep working: `hasVariants` already gates `srcset`.

- [ ] **Step 4: Run the Home suite** — `npx vitest run src/views/Home`. Expected PASS.

- [ ] **Step 5: Commit** `feat(home): srcset for art, fax, history and source-cover images`.

> **Ordering rule:** this commit may only be pushed **after** Task 6 uploads the variants — otherwise every one of these images 404s once and falls back (safe, but wasteful).

### Task 5: Dry run and visual spot check

- [ ] **Step 1:** `scripts/with-prod-secrets.sh aws -- node backend/scripts/build-media-variants.mjs --families art,history-thumbs,history-fax,fax-thumb,fax-covers,source-cover --list-only` → record per-family counts and original bytes in the audit doc.
- [ ] **Step 2:** Run the same families with `--limit 5 --out <scratchpad>/variants` (writes locally, uploads nothing). Expected: no failures; for `fax-thumb` and `fax-covers` the 256 px variant is < 15 KB and the 640 px < 60 KB on average.
- [ ] **Step 3: Look at three outputs** (one art, one fax thumb, one history fax page) with the image viewer. They must be sharp, correctly oriented, not blank. A line-art fax scan at 256 px may be too soft to read: if so, set that family's widths to `[400, 800]` in `FAMILIES`, re-run Task 3's test, and re-dry-run.
- [ ] **Step 4: Commit** any `FAMILIES` change.

### Task 6: Upload (KC confirms)

- [ ] **Step 1: Show KC the plan:** family counts, estimated variant bytes (dry-run average × count), the destination prefix `variants/`, that originals are untouched and that the upload is idempotent. **Wait for an explicit yes.**
- [ ] **Step 2:** `scripts/with-prod-secrets.sh aws -- node backend/scripts/build-media-variants.mjs --families <the six> --upload`. Expected summary: `failed: 0`.
- [ ] **Step 3: Verify five random keys per family** with `curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" https://media.bookofmormon.online/variants/256/<key>.webp`. Expected `200 image/webp` and sizes far below the originals.

### Task 7: Verify live on dev

- [ ] **Step 1:** `node scripts/home-audit/verify-images.mjs desktop` and `phone` (dev reads the same CDN). Expected: `broken: []`, no 4xx on `/variants/`, and totals down from the 2026-10-20 baseline (desktop deep scroll 8.3 MB; phone 4.4 MB). Record before/after in the audit doc.
- [ ] **Step 2:** Visually check one tile each for art, fax and history at desktop and phone (screenshots via the harness; `.tile-community` is masked). They must look as sharp as before at their rendered size on a 2× screen.
- [ ] **Step 3:** `node scripts/home-audit/pagepass.mjs` — cold/warm CLS must stay < 0.1 and Back/tab checks unchanged.

### Task 8: Ship it (KC confirms the push)

- [ ] **Step 1:** Full suite green (`cd frontend/webapp && npx vitest run`; backend `npx vitest run test/scripts`).
- [ ] **Step 2: Ask KC**, then `git push origin dev` and `git push origin dev:prod`; watch `gh run watch <id> --exit-status` for the `deploy-prod` run.
- [ ] **Step 3:** `node scripts/home-audit/prod-smoke.mjs`, plus `BASE=https://bookofmormon.online node scripts/home-audit/verify-images.mjs desktop` (expect art/fax/history now `variant:*`). Rollback if anything regresses: revert the Task 4 commit and push `prod` again (originals are untouched).
- [ ] **Step 4:** Append the result to the audit doc (R7) and commit.

---

## Part C — Close the unchecked states (Tasks 9–12)

### Task 9: Static scan for hardcoded English (TDD)

**Files:**
- Create: `frontend/webapp/src/views/Home/__tests__/hardcodedStrings.test.js`
- Modify: whichever tiles it flags

- [ ] **Step 1: Write the test**

```js
import fs from "node:fs";
import path from "node:path";

// Every user-visible string in a Home tile goes through label()/labelOr()/tr()
// so non-English hosts translate it. Flags JSX text and aria-label/alt/title
// string literals that contain English words and aren't routed through them.
const TILES = path.resolve(__dirname, "../tiles");
const files = fs.readdirSync(TILES).filter((f) => /\.jsx?$/.test(f));
const ALLOW = new Set([/* "file.js:Some literal" entries, each with a reason comment */]);

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const found = (src) => {
  const out = [];
  // aria-label="Foo bar", alt="Foo bar", title="Foo bar"
  for (const m of src.matchAll(/\b(?:aria-label|alt|title|placeholder)="([A-Za-z][^"{}]*[A-Za-z])"/g)) out.push(m[1]);
  // >Some text<  (JSX text with at least two letters, not an expression)
  for (const m of src.matchAll(/>\s*([A-Z][A-Za-z’'.,!?-]+(?:\s+[A-Za-z’'.,!?-]+)+)\s*</g)) out.push(m[1]);
  return out;
};

describe("Home tiles have no hardcoded English", () => {
  test.each(files)("%s", (f) => {
    const src = strip(fs.readFileSync(path.join(TILES, f), "utf8"));
    const bad = found(src).filter((s) => !ALLOW.has(`${f}:${s}`));
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** (`npx vitest run src/views/Home/__tests__/hardcodedStrings.test.js`). Expected: a list of real hits (the audit already found English in map story and archive tiles). Judge each: a genuine UI string → route it through `labelOr("key", "English fallback")`; data or a symbol → add to `ALLOW` with a reason.
- [ ] **Step 3: Fix the hits**, re-run until green, then run the Home suite.
- [ ] **Step 4: Label rows.** Collect any **new** keys; append them to a new SQL file generated the same way as `home_labels.sql` (English `bom_label` rows, type `home`, plus Korean `bom_translation` rows), show KC the list and statements, **wait for an explicit yes**, apply through the dev backend env credentials (piped, never printed), and verify with `{labels{key val}}` in `en` and `ko`.
- [ ] **Step 5: Commit** `fix(home): route remaining tile strings through label()`.

### Task 10: Tablet and dark-mode sweep script

**Files:**
- Create: `scripts/home-audit/sweep-states.mjs`
- Modify: `scripts/home-audit/README.md`

**Interfaces:**
- Consumes: `open(vp, group, { colorScheme })` from `tileharness.mjs` (`tablet` = 820×1180; dark = set `html[data-theme="dark"]` through `page.evaluate` — the app's theme switch).
- Produces: a per-state report and screenshots (gitignored).

- [ ] **Step 1: Write the script.** For each of `tablet` and `desktop+dark` and `phone+dark`: load Home, scroll 8 screens, then measure and print: (a) horizontal overflow (`scrollWidth > innerWidth`); (b) broken images (`complete && naturalWidth === 0` with a rendered width); (c) any tile taller than 1.5 viewport heights; (d) page errors and console errors; (e) layout-shift sum; (f) in dark mode, text elements inside `.tile` whose computed color vs the nearest opaque ancestor background has contrast < 4.5 (relative-luminance formula, sampled over `.tile p, .tile span, .tile a, .tile h3, .tile h4`, capped at 400 nodes, grouped by tile class and printed as `tile-class: n nodes < 4.5 (worst x.x:1)`); (g) `.tileCTA` and tile links with computed `outline-style: none` on `:focus-visible` (focus each of the first 5 and read the style). Save viewport screenshots of the first screen and one deep screen per state (community masked by the harness).
- [ ] **Step 2: Run** `node scripts/home-audit/sweep-states.mjs` and **read the screenshots yourself** (about 6 images). Judge sharpness, clipping, glare (white fax scans in dark mode), gold accent contrast.
- [ ] **Step 3: Fix what is real** (P0/P1 first), each with a failing test or a measured before/after, small commits. Contrast fixes go in tokens (`--tile-meta` etc. in `Sampler.css`), not per tile.
- [ ] **Step 4: Record** the table of findings (fixed / accepted + reason) in the audit doc under R7.

### Task 11: Korean host check (time-boxed spike, then decide)

**Time box: 30 minutes.** The app derives the language from the host (`determineLanguage`); `localhost` always returns `en`, so a Korean run needs a host that is not `localhost` but resolves to this machine.

- [ ] **Step 1:** Launch Chromium with `args: ["--host-resolver-rules=MAP kr.bomtest.test 127.0.0.1"]` and open `http://kr.bomtest.test:8201/home`. If Vite answers "Blocked request. This host is not allowed", start a **separate** Vite for this check with `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=kr.bomtest.test` (do not change the committed config or restart `bom-dev`).
- [ ] **Step 2:** If Home renders Korean (`document.documentElement.lang`, labels like `접기`), run the sweep script's metrics (overflow, clipped text via `scrollWidth > clientWidth` on tile text blocks, errors) and read 3 screenshots: look for truncated Hangul, mixed-language strings, English fallbacks (grep the visible text for `[A-Za-z]{4,}` outside of names).
- [ ] **Step 3:** If the spike fails inside the time box, **stop**: rely on Task 9's static scan as the Korean check and record "Korean live check not run: <reason>" in the audit doc. Do not keep digging.
- [ ] **Step 4:** Fix real findings (new keys follow Task 9 Step 4's label-row confirmation), commit.

### Task 12: Logged-in branches (component tests, no live login)

Dev runs sandboxed read-only, so a real signed-in session isn't available. Cover the branches with component tests that mock `useAppController`.

**Files:**
- Test: `frontend/webapp/src/views/Home/tiles/__tests__/ReadingProgressTile.test.js` (create)
- Modify only if a test exposes a defect

- [ ] **Step 1:** Write tests for `ReadingProgressTile` with a mocked bookmark (`pageSlug` set) for: renders the recent page link and progress dots; shows the heading and a link back to the page when the progress fetch rejects (B4); reserves its box while loading (no zero-height flash: assert the loading placeholder has the same `data-*`/class as the loaded root). Mock `BoMOnlineAPI` per the pattern in `ReadingPlanTile.test.js`.
- [ ] **Step 2:** Run; for any failing assertion that reflects a real bug, fix the component and keep the test.
- [ ] **Step 3:** Run the Home suite, commit `test(home): signed-in reading progress branches`.

### Task 13: Close out

- [ ] **Step 1:** Full suite green; `node scripts/home-audit/verify-back-edges.mjs` (desktop and phone) and `verify-back-sweep.mjs phone` still pass; `pagepass.mjs` CLS < 0.1.
- [ ] **Step 2:** Update the audit doc status and the memory note `home_tiles_production_readiness` (what shipped in this plan, remaining open items).
- [ ] **Step 3:** With KC's go, push `dev` and `prod` (Task 8's procedure) for the Part C fixes, then `prod-smoke.mjs`.

```bash
git add -A docs scripts
git commit -m "docs: Home tiles follow-ups closed out

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Coverage:** item 1 → Tasks 1–2; item 2 → Tasks 3–8; item 4 → Tasks 9–12 (+ close-out 13). Every Global Constraint has an owning gate: confirmations are Steps in Tasks 2, 6, 8, 9; the no-agents rule is stated in the header and the budget line.
- **Placeholders:** none left in code steps. Two steps describe a script body in prose because it reuses an existing verified script (Task 1 Step 2: the 15-check prod smoke already run on 2026-10-20) and an existing pipeline (Task 3 Step 5: `build-media-variants.mjs` plumbing); each lists the exact calls and options.
- **Type consistency:** `variantKey(width, key)`, `FAMILIES[{name,prefix,widths}]`, `plan(listed, existing)` are used identically in Tasks 3, 5, 6; the frontend `VARIANT_FAMILIES` regex in Task 4 lists exactly the `FAMILIES` prefixes (art, history/thumbs, history/fax, fax/thumb, fax/covers, source/cover).
- **Risk notes:** Part B can't be pushed before the upload (ordering rule in Task 4). Task 11 is explicitly time-boxed with a fallback. Part A needs KC's OK before touching prod over SSH.
