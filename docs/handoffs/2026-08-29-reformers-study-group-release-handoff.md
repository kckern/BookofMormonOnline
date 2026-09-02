# Reformers study-group release handoff

**Prepared:** 2026-08-29  
**Target:** unlisted production beta at `https://bookofmormon.online/home/feed`  
**Flagship:** *Reformers Discuss the Book of Mormon*  
**Repository baseline:** `prod` at `20ea55ee`, plus the uncommitted implementation in this working tree  
**Current decision:** ready to deploy with autonomous AI posting off; not approved to enable the scheduler yet

Read this together with:

- [chat/study-group inventory](../reference/chat-studygroup-inventory.md);
- [2026-08-29 readiness audit](../audits/2026-08-29-chat-studygroup-reactivation-readiness.md);
- [production blue/green operations](../../ops/production/README.md).

## 1. Objective

Restore the community feed and flagship AI study group as an unlinked production beta without reopening the old Sendbird-era architecture.

The intended product behavior is:

- `/home/feed` is directly reachable but absent from menus, tabs, group discovery, and the sitemap;
- anonymous visitors can read the explicitly unlisted flagship;
- membership is fixed and owner-controlled;
- only group members can create root posts;
- any authenticated human outsider can reply to an existing root or react;
- configured secondary AI respondents are not members and can reply only when selected by managed orchestration;
- outsider human and secondary-bot replies display an **Audience** badge;
- autonomous AI threads use database-owned identities, profiles, personas, prompts, topic selection, pacing, and limits;
- RAG is optional and intentionally empty for the initial beta.

URL obscurity is only a discovery mechanism. All read and write authorization is enforced by backend policy.

## 2. Current state at handoff

### Applied to production

The additive migration and reviewed external flagship configuration were applied successfully and independently read back.

| Item | Production state |
|---|---|
| Fresh channel | `981706be763a135623f56e621e39f9b9` |
| Legacy archive | `36eddcfa954553c01a2b8bacb6ff86f4` |
| Fresh visibility | `unlisted`, `listed=0`, policy enabled |
| Membership | `fixed` |
| Roots / replies / reactions | `members` / `authenticated` / `authenticated` |
| Ownership | one joined human operator |
| Primary bots | ten joined members |
| Audience bots | four configured non-members; zero membership rows |
| Topics | 38 total: 32 discursive, six narrative |
| Scheduler weighting | 80% discursive / 20% narrative |
| Local schedule | daily 08:00 `America/Denver` |
| Voices and pacing | 3–5 primary voices; 45–240 minutes between turns |
| Audience selection | zero or one topic-matched reply at a 35% configured chance |
| Completion | 72 hours or 12 bot messages; humans remain open until operator lock |
| Model | explicit per-bot `gpt-5-mini` configuration |
| Corpora / grants | zero / zero, intentionally |

The archive is private/read-only and its legacy schedule is disabled. Its historical messages and old prompt rows were not copied to the fresh channel.

The reviewed source JSON was intentionally not committed and its temporary copies were deleted after apply. Its apply-time SHA-256 was:

```text
b14f6b5a4b8031d69ccb7ddf7104e97a28cd4eb81bf847b55c5f23d4a6e35024
```

Database prompt evidence:

```text
prompt_template:     bdcd3729885618ac198d0cc16909778de5fd443652220d0b967573cf67352bfc
response_guardrails: 04c6a8857c17d6875c1d5f84d1598ed3ff02aa7f614a0ba98b480ccd196643bd
```

### Reachable in production

A browser-classified navigation request to `/home/feed` returned HTTP 200 and the CRA shell. A crawler/non-browser-style probe returned the front door's deliberate 404 behavior.

This proves the ingress and path-only shell. It does **not** prove that the application changes in this working tree have been deployed.

### Deliberately inactive

- The working-tree backend/frontend changes have not been deployed.
- `BOT_SCHEDULER_ENABLED` is not enabled in production.
- No newly authorized `OPENAI_API_KEY` has been provisioned for this release.
- No corpus has been ingested.
- The multi-role/two-browser acceptance matrix has not been run against the deployed build.

Do not retrieve or reuse credentials found in retired containers without explicit authorization. Provision a new provider credential instead.

## 3. Audience and membership semantics

There are two kinds of non-member participant:

### Authenticated human outsider

- Not individually allowlisted.
- May read, reply to an existing root, react, edit/delete their own reply, and report content.
- May not join, request membership, create a root, use member-only study actions, or inspect the human roster/presence.
- Their reply is stored with `participantRole: "audience"`.

### Configured AI audience respondent

- Listed in `bom_ai_audience_bot` with a channel, response weight, and topic triggers.
- Explicitly absent from `messenger_members`.
- Never opens a root.
- Orchestration selects at most one per managed thread.
- The selected reply is stored with `participantRole: "audience"`.
- Explicit-policy non-member bots are denied client-socket send, edit/delete, and reaction writes. Possession of the shared bot socket credential cannot bypass orchestration.

`bom_ai_audience_bot` is orchestration configuration, not membership or a general authorization table.

## 4. AI discussion behavior

1. The internal scheduler claims a due `bom_bot_schedule` row with a database lease.
2. It selects a passage-bound topic using the DB 80/20 discursive/narrative weighting.
3. It rotates the primary opener when possible.
4. The seed question remains a hidden editorial brief.
5. The opener generates an in-character response before any root is written.
6. The visible root contains the passage reference and generated opening, not the seed question verbatim.
7. The remaining primary voices become durable delayed turns.
8. At the configured chance, zero or one topic-matched audience respondent is appended as a reply-only turn.
9. Every subsequent voice receives the same hidden brief plus the visible thread.
10. When all work is posted/failed/skipped, or the time/message cap is reached, the thread becomes `bot_complete`.
11. `bot_complete` stops bots only. Human replies remain allowed until an operator locks the thread.

Prompts require historically bounded counterfactual characterization, concise in-character participation, deadpan absurdist humor, and no `as an AI` framing. Henry VIII is the principal comic foil, with only subtle topic-relevant wives/plural-marriage subtext.

All creative data is in the database. Active application code contains no flagship names, profiles, personas, character prompts, or topic questions.

## 5. RAG disposition

RAG is implemented but deferred.

- No corpus or grant rows exist in production.
- Retrieval with no grants returns no corpus passages and does not block generation.
- Bots must not claim grounding in their historical corpus in this mode.
- Unverified long quotations remain rejected.
- Bible ↔ Book of Mormon cross-reference expansion is implemented and will enrich later corpus searches.

The unprocessed source folder remains outside this repository:

```text
/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/bots/_inbox/Reformers
```

Rights review, edition hashing, ingestion, and missing-author acquisition are a later grounding phase. They are not initial-beta blockers.

## 6. Repository implementation map

| Area | Primary location |
|---|---|
| Additive schema | `backend/migrations/2026-08-29-study-group-public-beta.sql` |
| Migration verifier | `backend/scripts/apply-study-group-migration.ts` |
| External-config validator/applicator | `backend/scripts/configure-study-group.ts` |
| Managed scheduler | `backend/src/bots/scheduler.ts` |
| Model gateway | `backend/src/bots/mastra/model.ts` |
| Optional RAG and publication checks | `backend/src/bots/mastra/rag.ts` |
| Corpus ingestion | `backend/scripts/ingest-ai-corpus.ts` |
| Scripture bridge | `backend/src/bots/scriptureBridge.ts` |
| Channel policy | `backend/src/messaging/policy.ts` |
| Realtime message policy | `backend/src/realtime/handlers/message.ts` |
| Realtime reaction policy | `backend/src/realtime/handlers/reaction.ts` |
| Home-feed projection | `backend/src/graphql/resolvers/community.ts` |
| Path-only frontend gate | `frontend/webapp/src/models/featureFlags.js` |
| Home feed and Audience badge | `frontend/webapp/src/views/Home/Feed.js` |
| Study-view Audience badge | `frontend/webapp/src/views/_Common/Study/Study.js`, `StudyChat.js` |

Deprecated prompt/persona entry points are tombstones and must not be revived.

## 7. Tooling inventory

### Study CLI

There is no `cli/` directory. The existing community simulator is:

```sh
node scripts/study.cli.mjs help
```

Its supporting modules and scenarios are under `scripts/study/`. It is useful for scratch-group and general authorization/realtime tests. `scripts/study/scenarios/reformers.yaml` is intentionally retired because it encoded obsolete channel behavior.

The study CLI currently has no supported “run one managed AI thread” command. Before autonomous activation, add a narrow run-once operator command or equivalent reviewed administrative entry point. Do not use a permanently enabled scheduler as a substitute for a controlled one-thread smoke test.

### Backend operational scripts

Run from `backend/`:

```sh
npm run study-group:migrate -- --help
npm run study-group:configure -- --file /secure/reviewed.json
npm run corpus:ingest -- --all
```

Migration, configuration, and corpus commands default to dry-run. Production writes require their documented `--apply` option and `SANDBOX=0`.

The migration and flagship configuration are already applied. Do not re-run the configurator without a reviewed external file and a clear reason.

### Clicky

The read-only Clicky JSON API client is:

```sh
CLICKY_SITE_ID=66488278 CLICKY_SITEKEY='…' node scripts/traffic.cli.mjs summary
```

The CLI automatically loads the root gitignored `.env`, and the sitekey is environment-only. The rest of the integration consists of:

- `docs/reference/clicky-integration.md`;
- `frontend/next/lib/clicky.ts` and Next middleware;
- `frontend/webapp/src/models/analytics/providers/clicky.js`;
- unit tests in both frontends;
- build/runtime arguments in `Dockerfile` and `.github/workflows/deploy-prod.yml`.

For this beta, verify the normal `study` and `comment` goals in a real production browser if analytics acceptance is desired.

## 8. Validation already completed

Observed on 2026-08-29:

- production migration/configuration apply: passed;
- independent production database readback: passed;
- GraphQL code generation: passed;
- backend strict typecheck: passed;
- backend production build: passed;
- focused backend tests: five files, 31 tests passed;
- focused frontend tests: four suites, 42 tests passed;
- optimized frontend build: exited successfully with existing repository warnings;
- `git diff --check`: passed;
- active-code creative-data scan: no flagship personas/names/prompts found;
- browser-classified public `/home/feed` request: HTTP 200.
- Clicky traffic CLI: four Node tests passed; help and executable entry point verified.

Three optional persona tests report their existing DB-unreachable skip path in the local test environment; they are not counted as production DB proof. The independent production readback is the DB evidence.

## 9. Required deployment sequence

### Phase A — prepare the release

1. Record the currently deployed image/commit as the rollback point.
2. Review the working tree and create a focused release commit.
3. Do not include unrelated untracked files, especially:
   - `godaddy-support-korean-nameservers.html`;
   - `godaddy-support-reply.html`.
4. Confirm the production environment has a writable DB user and `SANDBOX=0`.
5. Keep `BOT_SCHEDULER_ENABLED` absent or `false`.
6. Keep the new provider credential absent during the first deployment if desired; generation then fails closed.
7. Configure `REDIS_URL` before testing overlapping blue/green realtime traffic. The scheduler has a DB lease, but socket rooms/presence need Redis across concurrent processes.

### Phase B — deploy scheduler-off

The production workflow builds and pushes on a `prod` branch update. The host's blue/green systemd timer pulls the moving `:prod` image and promotes a healthy inactive slot.

Relevant operational commands on the production host:

```sh
sudo systemctl start bom-deploy.service
sudo journalctl -u bom-deploy.service -n 100 --no-pager
sudo systemctl list-timers bom-deploy.timer
```

Do not enable autonomous posting as part of this deploy.

### Phase C — validate the human beta

Browser-route probe:

```sh
curl -sS -o /dev/null -D - \
  -A 'Mozilla/5.0' \
  -H 'Sec-Fetch-Mode: navigate' \
  -H 'Sec-Fetch-Dest: document' \
  -H 'Accept: text/html,application/xhtml+xml' \
  https://bookofmormon.online/home/feed
```

Expect HTTP 200. In a real browser confirm:

- no menu, tab, sidebar, group selector, or sitemap entrance;
- `noindex,nofollow,noarchive` is present;
- anonymous feed and thread reads work;
- a signed-in outsider cannot join/request or create a root;
- that outsider can reply/react and receives the Audience badge;
- a member can create a root;
- an operator can delete, lock/unlock, mute/ban, and process reports;
- a banned user loses reads and live-room access;
- two browsers receive reply, edit/delete, and reaction events live;
- private channel/message/thread IDs remain unreadable to outsiders.

Use distinct sessions for anonymous, outsider, member, operator, and banned-user roles. The existing study CLI can support scratch/realtime checks, but it does not replace this flagship role matrix.

### Phase D — prepare AI activation

1. Provision a new `OPENAI_API_KEY` through the normal secret-management path.
2. Set provider spend/rate alerts.
3. Add a supported run-once managed-thread command.
4. Run exactly one controlled flagship thread.
5. Review:
   - visible root is in character;
   - seed question is not repeated as a host line;
   - passage and topic are appropriate;
   - humor is dry and not disruptive;
   - no fabricated historical encounter or unsupported quotation appears;
   - primary turns are staggered;
   - no more than one Audience bot appears;
   - Audience badge is correct;
   - thread reaches `bot_complete` while human replies remain open.

### Phase E — enable the schedule

Before setting `BOT_SCHEDULER_ENABLED=true`, inspect `bom_bot_schedule.next_run_at` for the fresh channel.

**Important:** if `next_run_at` is already in the past, enabling the process scheduler will claim it and attempt a thread within approximately one 60-second tick. Advance it to a deliberately reviewed future 08:00 `America/Denver` occurrence, or explicitly approve the immediate run. Do not calculate future occurrences by blindly adding 24 hours across DST.

Then:

1. set `BOT_SCHEDULER_ENABLED=true`;
2. deploy/restart through the normal path;
3. watch one complete daily run;
4. confirm the DB lease prevents a duplicate root during slot overlap;
5. confirm delayed turns survive process restart;
6. leave the beta unlisted until moderation and quality are satisfactory.

## 10. Monitoring queries and signals

Monitor:

- application logs for `[bots] scheduler`, `no-model-provider`, schedule failures, and turn failures;
- `bom_bot_schedule.last_run_at` and `next_run_at`;
- `bom_ai_discussion_turn.status`, `failure_reason`, `lease_owner`, and `lease_expires_at`;
- `messenger_thread_state.status`, `bot_message_count`, and `bot_complete_at`;
- open `messenger_content_report` rows;
- provider spend and rate-limit dashboards;
- realtime reconnects, missed fan-out, and Redis availability;
- home-feed GraphQL latency and public error rate.

Unexpected immediate repeated roots are a stop condition. Disable the schedule before debugging.

## 11. Rollback

Fast, data-preserving AI rollback:

```sql
UPDATE bom_ai_discussion_config
SET enabled = 0
WHERE channel_url = '981706be763a135623f56e621e39f9b9';

UPDATE bom_bot_schedule
SET enabled = 0
WHERE channel_url = '981706be763a135623f56e621e39f9b9';
```

Hide the beta channel as well:

```sql
UPDATE messenger_channel_policy
SET enabled = 0
WHERE channel_url = '981706be763a135623f56e621e39f9b9';
```

Global realtime kill switch, only if necessary:

```text
MESSENGER_ENABLED=false
```

This stops Socket.IO initialization but does not unregister GraphQL messenger resolvers. Prefer the channel/schedule switches for a scoped incident.

Application rollback uses the recorded image/commit or:

```sh
sudo /home/ubuntu/greenfield/rollback-blue-green.sh
```

Do not delete the fresh channel, archive, messages, topics, personas, or evidence during rollback.

## 12. Remaining work and ownership decisions

Required before autonomous AI activation:

- [ ] Focused release commit and scheduler-off deployment.
- [ ] Production multi-role/two-browser matrix.
- [ ] New provider credential and spend controls.
- [ ] Supported one-thread operator command.
- [ ] Manual generated-thread review.
- [ ] Moderator/report owner and response SLA.
- [ ] Reviewed `next_run_at`, followed by scheduler enablement.

Deferred until corpus-grounded claims or broader discovery:

- [ ] Rights and edition review for collected works.
- [ ] Acquire missing primary corpora.
- [ ] Hash, register, ingest, and grant corpora per bot.
- [ ] Prove one bot cannot retrieve another bot's ungranted sources.
- [ ] Review at least seven generated threads across both topic classes.

## 13. Sign-off record

| Gate | Owner | Result/date |
|---|---|---|
| Release commit reviewed |  |  |
| Scheduler-off deployment healthy |  |  |
| Human authorization matrix |  |  |
| Two-browser realtime test |  |  |
| Moderator/report SLA named |  |  |
| Provider key and spend cap |  |  |
| Manual AI thread accepted |  |  |
| First scheduled run accepted |  |  |

The beta may remain available for human testing after Phase C. Autonomous posting begins only after every Phase D/E activation gate is explicitly signed off.
