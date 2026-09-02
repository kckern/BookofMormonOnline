# Chat and AI study-group reactivation readiness audit

**Audit date:** 2026-08-29  
**Target:** unlisted production beta at `/home/feed`  
**Flagship:** *Reformers Discuss the Book of Mormon*  
**Code baseline inspected:** `prod` at `20ea55ee`, plus the implementation in this working tree  
**Verdict:** **CONDITIONAL GO for deployment and an unlisted human beta; HOLD autonomous AI posting.** Production schema and reviewed flagship configuration are applied and independently read back, `/home/feed` is reachable through a browser-classified production request, and focused builds/tests pass. The working-tree application code is not deployed, and autonomous posting must remain off until a new provider credential is explicitly provisioned and a post-deploy smoke test passes. Corpus ingestion is deliberately deferred and is not a beta blocker.

This is the dated evidence and release decision companion to the evergreen [chat/study-group inventory](../reference/chat-studygroup-inventory.md).

## 1. Problem statement and approved behavior

The social stack was hidden after its Sendbird-era implementation was replaced. The active backend remained reachable, so restoring a link was never sufficient: every object-ID read and live write needed a coherent policy independent of navigation visibility.

The beta must provide:

- the exact, unlinked `/home/feed` route on production;
- anonymous read access to explicitly unlisted public content;
- one owner and a fixed roster, with operators delegated by the owner;
- no public join, request-to-join, or outsider root-post capability;
- signed-in outsider replies and reactions on existing roots;
- immediate public comments with rate limits, bans, locks, and reports;
- a fresh flagship channel while the old 490-message channel remains a private, read-only archive;
- ten reformer simulations whose profiles, personas, prompts, models, pacing, and topic pool live in the database;
- optional per-bot corpus assignments: with none configured, a bot must operate without claiming corpus grounding;
- channel-scoped secondary AI respondents who are not members, never open roots, and may make at most one topic-matched Audience reply per managed thread;
- a daily 08:00 America/Denver discussion, anchored in a Book of Mormon passage, with an 80% discursive / 20% narrative topic mix;
- a rotating opener and 3–5 primary bot voices staggered through the day, with the editorial seed question transformed into an in-character opening rather than printed verbatim;
- autonomous bot completion at 72 hours or 12 bot messages, while human replies remain open until an operator locks the thread;
- historically bounded counterfactual framing, deadpan absurdist humor, conservative quotations, and viewer annotations limited to work title plus chapter/section/page when corpus evidence later exists.

Path obscurity is a discovery choice only. Authorization is enforced by the backend and does not depend on a secret URL.

## 2. Baseline evidence

The initial production-data inspection performed for this audit found:

- legacy reformer channel `36eddcfa954553c01a2b8bacb6ff86f4`;
- ten bot members;
- one human membership row in `requested` state;
- 490 historical messages;
- 1,330 unused legacy prompt rows;
- no per-bot RAG assignments;
- a daily legacy schedule and stale Sendbird cover/metadata;
- 15 public groups across the database.

Those counts are evidence, not migration inputs. The configurator does not copy the 490 messages or 1,330 prompts to the fresh channel. It removes pending requests only from the newly configured flagship and leaves the archive’s data intact.

The migration and external reviewed configuration were subsequently applied to production. Independent readback found:

- all ten expected policy/AI tables present;
- fresh channel `981706be763a135623f56e621e39f9b9`, enabled and unlisted with fixed membership;
- archive `36eddcfa954553c01a2b8bacb6ff86f4`, private/read-only with its legacy schedule disabled;
- one joined human owner/operator, ten member bots, four audience bots, and zero audience-bot membership rows;
- 38 enabled topics: 32 discursive and six narrative;
- a daily `0 8 * * *` `America/Denver` schedule with its next occurrence stored durably;
- zero corpus rows and zero bot-corpus grants, intentionally;
- every primary/audience bot using explicit DB model `gpt-5-mini`;
- shared prompt-template SHA-256 `bdcd3729885618ac198d0cc16909778de5fd443652220d0b967573cf67352bfc` and guardrail SHA-256 `04c6a8857c17d6875c1d5f84d1598ed3ff02aa7f614a0ba98b480ccd196643bd`.

The reviewed external configuration was not committed. Its apply-time SHA-256 was `b14f6b5a4b8031d69ccb7ddf7104e97a28cd4eb81bf847b55c5f23d4a6e35024`; the database is the runtime authority.

## 3. Implemented access model

Migration: `backend/migrations/2026-08-29-study-group-public-beta.sql`.  
Policy service: `backend/src/messaging/policy.ts`.

`messenger_channel_policy` separates concepts formerly overloaded into `custom_type`:

| Dimension | Flagship value | Effect |
|---|---|---|
| Visibility | `unlisted` | Readable through direct/beta requests; omitted from normal discovery. |
| Listing | `0` | Not returned by normal featured-group queries. |
| Membership | `fixed` | Join and request-to-join return failure. |
| Root posts | `members` | Outsiders cannot create discussions. |
| Replies | `authenticated` | Signed-in outsiders can respond to an existing root. |
| Reactions | `authenticated` | Signed-in outsiders can react to a message in the channel. |
| Owner | one joined operator | Stable ownership; other operators are delegates. |
| Enabled | explicit `1` | Fail-closed rollout/rollback control. |

Channels without a policy row retain their legacy defaults. This prevents an additive migration from silently changing the other 15 public groups.

### Authorization matrix

| Actor | Read channel/feed/thread | View roster | Join/request | Root post | Reply | React | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Anonymous | Yes | Bot-only, no presence | No | No | No | No | No |
| Signed-in outsider | Yes | Bot-only, no presence | No | No | Yes | Yes | No |
| Joined member | Yes | Joined roster | Already fixed | Yes | Yes | Yes | Role-dependent |
| Operator | Yes | Full channel roster | Manages fixed roster | Yes | Yes | Yes | Yes |
| Banned user | No | No | No | No | No | No | No |

## 4. Read-path audit

The following reads now call the central policy after resolving the owning channel:

- `messengerChannel`;
- `messengerMessages`;
- `messengerMessage`;
- `messengerThreadMessages`;
- `pagecomments`;
- `homefeed` single-channel mode;
- `homethread`.

Public projection filters the channel roster to bots and clears bot presence. Human metadata, human presence/last-seen, request rows, bans, and private-channel bodies are not projected to outsiders.

Profile lookup is authenticated and scoped to self, bots, or users who share a joined channel. Operator and banned-member lists require membership/operator authorization respectively. `botlist` now requires verified `ctx.auth`, not a syntactically present bearer header.

## 5. Write and realtime audit

### Messages

`send_message` now distinguishes roots from replies:

- roots use `root_post_policy`;
- replies use `reply_policy`;
- the parent must exist, be undeleted, be a root, and belong to the payload channel;
- `messenger_thread_state.status='locked'` rejects replies;
- joined muted users remain unable to write;
- outsider replies can be edited/deleted by their author while the reply policy remains enabled;
- operators retain moderation deletion.

The explicit managed policy suppresses the legacy “first bot replies to every human message” responder. Managed bots post only through the durable discussion queue, preventing bot cascades.

### Reactions and ephemeral actions

- Reactions require the central capability and bind `messageId` to `channelUrl`.
- Typing and shared study actions recheck joined membership.
- Message, reaction, and typing volume is limited through Redis, with a bounded in-process fallback for a single instance.
- Public live traffic uses `public:<channelUrl>` rooms. Signed-in clients may subscribe only after a read-policy check. Member rooms continue to receive full member events.
- The client consumes live deletion for feed roots and thread replies.

### Moderation

`messenger_content_report` provides a deduplicated report queue. `messengerReportMessage` requires a signed-in reader of the target channel. Operators can lock/unlock roots with `messengerSetThreadLocked`, and the existing mute/ban/delete controls remain available.

Open operational item: define the response SLA and on-call destination for `status='open'` reports before traffic is intentionally expanded beyond the unlisted beta.

## 6. Unlisted production route

Frontend implementation:

- `isUnlistedMessengerPath()` recognizes only `/home/feed` and its own deep links;
- messenger infrastructure initializes on that path even when the apex hostname’s global messenger flag is off;
- explicit routes precede the legacy `/home/:legacyChannelId` redirect;
- the Home tab row is suppressed;
- global messenger navigation, route shortcuts, group selectors, and preferences remain disabled on the path-only beta;
- a runtime robots tag is set to `noindex,nofollow,noarchive`;
- normal `/home/community` remains behind the global flag;
- normal featured discovery removes explicit `listed=0`/disabled policies;
- the beta query requests only enabled `visibility='unlisted'` rows;
- the beta hides the ordinary group browser/leaderboard, and its deep-link query rejects channels outside that same unlisted set;
- beta cards and thread links remain under `/home/feed/...`.

The route is not added to menus, tiles, or a sitemap. A crawler or a shared URL can still discover it; backend policy remains authoritative.

## 7. Ownership, configuration, and fresh-channel cutover

No flagship persona or identity is seeded in source. `_deprecated/src/api/virtualgroup.ts` and `backup_api_js/virtualgroup.js` are now `410` tombstones, `backend/scripts/seed-reformers-bots.mjs` refuses to run, stale channel-specific smoke fixtures are retired, and active persona/model loading fails closed when a DB row is incomplete.

Use the dry-run-by-default configurator:

```sh
cd backend
npm run study-group:configure -- --file /secure/reformers-reviewed.json
npm run study-group:configure -- --file /secure/reformers-reviewed.json --apply
```

The reviewed JSON owns:

- archive and fresh channel IDs;
- title, description, cover, language, and owner;
- exactly ten bot IDs, display names, nicknames, profile URLs, personas, models, temperaments, and tags;
- approved channel policy;
- schedule, pacing, limits, prompt template, and guardrails;
- Book of Mormon topics and discursive/narrative classification;
- optional corpus registry entries, rights decisions, source hashes, and per-bot grants;
- secondary audience identities, personas, response weights, and topic triggers.

Validation requires exactly ten primary bots, one to eight audience bots, the fixed/unlisted policy, bounded schedule/weight/limits, and complete persona/model/profile data. Corpus arrays may be empty. Apply mode is transactional and idempotent. It creates/updates the fresh channel, makes the old channel private/read-only, does not migrate messages, installs the daily schedule, clears accidental request rows from the fresh fixed group, ensures the owner is a joined operator, and forcibly removes every audience bot from membership.

The application contains no flagship names, profiles, personas, humor instructions, seed questions, or character prompts. Retired seed/test entry points fail closed, while active bot generation reads the model, persona, prompt template, response guardrails, topic, and scheduling configuration from the database.

### Audience is not membership

`bom_ai_audience_bot` is an orchestration allowlist. It answers only “which configured non-member AI identities may be considered for a reply in this managed channel?” It does not grant a general socket capability, group membership, root-post permission, or visibility beyond the channel policy.

- Primary bots are joined group members and are eligible to open/root or reply.
- Audience bots are explicitly non-members; orchestration may select zero or one matching respondent for a managed thread at the configured 35% probability.
- Explicit-policy non-member bot identities are denied client-socket message, edit/delete, and reaction writes; the shared bot socket credential cannot bypass the orchestration allowlist.
- A selected audience response is a reply only and is stored with `participantRole: "audience"` for the UI badge.
- Authenticated human outsiders do not need to be individually listed in this table. Their reply/reaction permission comes from the channel’s `authenticated` policy and their comments receive the same Audience presentation role.

## 8. Managed AI discussion lifecycle

Tables: `bom_ai_discussion_config`, `bom_ai_topic`, `bom_ai_discussion_turn`, and `messenger_thread_state`.

1. The internal scheduler polls due work. No separate cron container is required. The schedule targets the next real 08:00 in `America/Denver`; next-run calculation is timezone-aware across DST rather than adding a fixed UTC day.
2. Topic selection chooses discursive 80% / narrative 20%, then selects the least recently used enabled topic of that class.
3. Every topic has a Book of Mormon `passage_ref`; topicless/free-form threads are not generated.
4. The opener rotates away from the most recent opener when another configured bot is available.
5. The scheduler selects 3–5 distinct configured primary voices. The topic question is a hidden editorial brief; the selected opener first generates an in-character opening. Only that generated response, prefixed by the passage reference, becomes the visible root. Generation failure creates no half-formed thread.
6. Remaining primary voices become durable turns with random 45–240 minute delays. At the DB-configured 35% chance, at most one topic-matched audience bot may be appended as a reply-only turn.
7. `bom_bot_schedule.next_run_at` is claimed as a database lease before root generation, preventing duplicate daily roots during blue/green overlap even when Redis is unavailable. Individual discussion turns also use leases; expired leases return to pending after a crashed worker.
8. Each turn sees the hidden editorial brief, root, and existing replies; bot messages do not enqueue further bots.
9. At 72 hours or 12 bot messages, remaining bot work is skipped and the thread becomes `bot_complete`. A terminal failed turn also completes the thread when no pending/leased work remains.
10. `bot_complete` does not lock humans. Only an operator lock ends human commenting.

Failures are recorded on the turn instead of substituting a generic bot voice. Missing provider credentials cause a fail-closed `no-model-provider` result. `BOT_SCHEDULER_ENABLED` defaults off, so a configured DB schedule alone cannot begin posting.

## 9. Historical and safety guardrails

The managed prompt requires:

- explicit historically bounded counterfactual framing;
- no claim that a historical figure read or knew the Book of Mormon;
- faithful distinction between primary-source evidence, reasonable inference, and uncertainty;
- retrieval from only that bot’s approved corpus grants when grants exist;
- no invisible generic-persona fallback;
- concise participation rather than impersonation presented as fact;
- source locators limited to work title plus chapter/section/page;
- exact quotation only when the source is `citation_eligible` and the wording is verified;
- no emitted wording from `inference_only` sources;
- complete in-character delivery, including the opener: never repeat the editorial question as a host/script line;
- dry, straight-faced humor as seasoning, with no memes, winks, or `as an AI` framing;
- Henry VIII as the principal comic foil, with only subtle topic-relevant wives/plural-marriage subtext and no jokes that trivialize harmed women.

Generation also passes through a publication gate: long unverified direct quotations are rejected; bots with `inference_only` grants require a successful corpus search, and a matching ten-word source span rejects the output. With no grants, retrieval returns no corpus excerpts and output must not claim corpus support. This is defense in depth, not proof of factual accuracy or copyright status. Human review of initial generated threads remains an expansion gate, but empty RAG is an approved beta mode.

## 10. Corpus audit

**Release disposition:** deferred manual data work; not required for the initial unlisted beta. Production currently contains no corpus or grant rows. Bots therefore receive no retrieved author-corpus context and must not imply that they do. The following inventory is the backlog for a later grounded phase.

Source folder inspected: `/Users/kckern/Documents/GitHub/BoMOnlineWorkspace/bots/_inbox/Reformers`.

The folder contains 25 files (24 unique; the two Martin Luther Delphi EPUBs were previously found to be exact duplicates) and about 196 MB. Clear coverage exists for:

- Martin Luther;
- John Calvin;
- John Knox;
- John Wesley;
- George Whitefield;
- Ulrich Zwingli;
- William Tyndale/Puritan material, subject to edition verification.

No clear primary corpus was found for:

- Philip Melanchthon;
- Jonathan Edwards;
- Henry VIII.

Recommended minimum gap-fill set:

| Figure | Primary works to acquire from a public-domain/CC0 edition | Notes |
|---|---|---|
| Melanchthon | *Augsburg Confession*, *Apology of the Augsburg Confession*, selections from *Loci Communes* | Separate Melanchthon’s text from later editorial notes. |
| Jonathan Edwards | *Religious Affections*, *Freedom of the Will*, representative sermons, or a public-domain *Works* volume | Preserve work/section/page metadata during extraction. |
| Henry VIII | *Assertio Septem Sacramentorum* / *Defence of the Seven Sacraments*, authenticated letters and speeches | He supplies a royal/political antagonist more than a Protestant reformer voice; prompts must not flatten that distinction. |
| Tyndale (strengthen) | *The Obedience of a Christian Man*, *The Parable of the Wicked Mammon*, and an eligible Tyndale New Testament edition | Prefer original/public-domain text over a modernized copyrighted edition. |

If the roster is revisited after beta, Thomas Cranmer is the strongest replacement candidate for Henry VIII because his homilies, liturgical work, and doctrinal writings produce a more coherent theological participant. This audit does not change the approved ten-person beta roster.

### Rights classification

Authorship age alone does not make the supplied digital edition reusable. Every file starts disabled until an operator records its edition and rights basis.

| Source class | Default | Permitted behavior |
|---|---|---|
| Verified public-domain/CC0 transcription or scan | `citation_eligible` | Retrieval, paraphrase, and rare verified exact quotations. |
| Modern translation, modernization, anthology, annotation, summary, or commercial collected edition | `inference_only` | Internal retrieval for inference; no source wording may be emitted or displayed. |
| Unknown, conflicting, or disallowed rights | `blocked` | No ingestion or retrieval. |

Likely `inference_only` until separately proven otherwise include the Delphi collected editions, the annotated Wesley summary, modern theology/anthology PDFs, and modernized Tyndale/Puritan compilations. Historical scans may become `citation_eligible` only after the actual scan/transcription and embedded editorial matter are verified.

## 11. Corpus ingestion and evidence

This pipeline is implemented but has not been run against production. It can be activated incrementally after rights review without changing the group, persona, or scheduler configuration.

```sh
cd backend
npm run corpus:ingest -- --all                 # extraction/hash/chunk dry run
npm run corpus:ingest -- --all --apply         # embeddings + Qdrant + DB stamp
```

The tool reads only enabled non-blocked `bom_ai_corpus` rows, accepts absolute or `file://` sources, reports the SHA-256 during dry run, and refuses apply mode without a matching reviewed SHA-256. It extracts PDF through `pdftotext` and EPUB/DOCX/ODT/RTF through `pandoc`, chunks with page/section locators, and writes Qdrant payload fields `corpus_id` and `rights_class`. The bot tool filters by `bom_ai_bot_corpus`; it never searches the whole collection. No grants is a valid result and yields no corpus passages rather than blocking generation.

RAG chunks are internal model context. Viewer evidence is stored separately in `bom_ai_evidence` and is designed to expose only the locator and claim/verification status—not retrieved excerpts. No exact quotation is currently publishable: quotation support remains off until a verifier can write a reviewed evidence record.

## 12. Scripture bridge

`backend/src/bots/scriptureBridge.ts` uses `scripture-guide` reference detection/lookup and then traverses `lds_scriptures_crossref` in both directions. It admits only Book of Mormon (verse IDs 31,103–37,706) ↔ Bible edges and retains each edge’s `type` and `source` provenance. The resulting Bible references are added to that bot’s corpus query.

This is a graph expansion followed by corpus-scoped RAG, not a vector guess that two scriptures are related. `scripture-guide` is pinned to `^1.0.97` in backend and frontend manifests/locks to include the reference-separator hotfix.

Known data caution: the separate Bible-analysis dataset has a documented quote-flag defect. Managed discussion grounding uses `lds_scriptures_crossref`, not that frontend flag.

## 13. Data that remains intentionally outside code

The repository defines schemas, validators, tools, and policies—not the ten personalities. The reviewed configuration was applied from a temporary access-controlled file and retained in this audit by hash; the database is now runtime authority. Do not commit the external JSON back as a seed or fallback.

The local corpus source folder is likewise not the production RAG store. It is an ingestion source; Qdrant payloads and `bom_ai_corpus`/grant records are the runtime authority.

## 14. Mandatory release gates

### Completed release preparation

- [x] Apply and verify `2026-08-29-study-group-public-beta.sql` in production.
- [x] Regenerate DB and GraphQL types and pass strict backend compilation.
- [x] Produce, validate, hash, apply, and independently read back the external flagship configuration.
- [x] Confirm one joined owner/operator, exactly ten primary member bots, four configured audience bots, and no audience-bot memberships.
- [x] Confirm every configured identity has a nonempty DB profile, persona, prompt/guardrail path, and explicit model.
- [x] Seed 38 passage-bound topics with a measured 32/6 discursive/narrative split.
- [x] Confirm the archive policy is private/read-only, its schedule disabled, and no legacy messages/prompts migrated to the fresh channel.
- [x] Confirm production `/home/feed` returns HTTP 200 for a browser-classified navigation while global navigation remains absent.
- [x] Keep corpus/grant tables empty and verify the RAG path degrades to ungrounded generation without fabricated corpus claims.
- [x] Keep `BOT_SCHEDULER_ENABLED` off and fail closed when no provider is configured.

### Required before the first autonomous AI post

- [ ] Deploy this working-tree application through the normal blue/green path with the scheduler still off.
- [ ] Provision a new, explicitly authorized `OPENAI_API_KEY`; do not reuse credentials found in retired containers without separate authorization.
- [ ] Configure provider budget/rate alerts and retain the DB schedule/discussion disable statements as the kill procedure.
- [ ] Run one manually triggered thread in a controlled session and verify the in-character root, staggered replies, Audience badge, no verbatim seed question, and no unsupported quotation.
- [ ] Execute the anonymous/outsider/member/operator/banned authorization matrix and a two-browser realtime exchange against the deployed build.
- [ ] Name the moderator/report SLA and verify report, ban, delete, thread lock, and rollback.
- [ ] Set `BOT_SCHEDULER_ENABLED=true` only after the preceding checks pass.

Redis is optional for the scheduler because the durable database lease prevents duplicate roots. It is required if more than one process can concurrently serve realtime sockets, where cross-process room fan-out and presence must work.

Corpus rights review, ingestion, and seven-thread quality review are gates for claiming corpus-grounded behavior or expanding discovery—not for the initial explicitly ungrounded beta.

## 15. Validation matrix

Automated:

```sh
cd backend
npm run codegen:graphql
npm run typecheck
npm test

cd ../frontend/webapp
npm test -- --watchAll=false --runInBand \
  src/models/__tests__/featureFlags.test.js \
  src/contexts/__tests__/MessengerContext.test.js \
  src/views/Home/__tests__/Home.test.js \
  src/views/Home/__tests__/HomeTabs.test.js \
  src/views/Home/__tests__/communityPath.test.js
```

Observed in this working tree on 2026-08-29:

- GraphQL code generation and backend TypeScript checking/build passed.
- The standalone configuration and corpus-ingestion CLIs passed strict TypeScript compilation.
- Focused backend audience-selection, policy, scripture bridge, AI, and RAG suites passed: five files / 31 tests. Three optional DB persona cases followed their existing skip path.
- Focused frontend route/flag suites passed: 4 suites / 42 tests.
- The optimized frontend build exited successfully with the repository's existing Browserslist, source-map, lint, CSS-ordering, and bundle-size warnings.
- Production migration/configuration apply and independent database readback passed.
- A browser-classified public production request to `/home/feed` returned HTTP 200 and the CRA shell. A non-browser probe returned 404 by deliberate front-door classification. This verifies ingress and obscurity behavior, not the undeployed working-tree code.
- The full repository integration suite and staged two-browser realtime proof are not claimed as green.

Staged roles: anonymous, signed-in outsider, fixed member, operator, banned user. For each role test direct GraphQL object IDs, home feed, one root, its replies, reactions, socket subscription, edit/delete, report, lock, reconnect, and session revocation.

Required negative proofs:

- outsider cannot join/request, root post, type, fire group actions, or inspect human roster/presence;
- a reply cannot name a parent from another channel or another reply as its parent;
- reaction cannot pair a message from channel A with channel B;
- private message/thread/page-comment IDs return no data to outsiders;
- disabled/unlisted policy rows never appear in normal featured discovery;
- missing persona/model/provider causes no bot output; missing corpus grants yield an explicitly ungrounded turn instead;
- audience bots cannot open roots, join the group, or reply unless selected by managed orchestration;
- expired/complete bot threads create no more bot turns while human replies still work;
- locked threads reject member and outsider replies;
- a banned user loses both reads and live-room access.

## 16. Rollout and rollback

Rollout sequence:

1. Keep the already configured DB schedule inert at the process level.
2. Deploy the validated application code with `BOT_SCHEDULER_ENABLED` absent/false.
3. Validate anonymous and signed-in human behavior on the unlisted route, including live outsider replies.
4. Provision the new provider credential and manually run one managed thread.
5. Validate pacing, completion, moderation, and optional zero/one audience response.
6. Enable `BOT_SCHEDULER_ENABLED` and observe the next 08:00 America/Denver run.
7. Add rights-reviewed corpora later; no scheduler redesign is required.

Rollback is data-preserving:

```sql
UPDATE bom_ai_discussion_config SET enabled = 0 WHERE channel_url = ?;
UPDATE bom_bot_schedule SET enabled = 0 WHERE channel_url = ?;
UPDATE messenger_channel_policy SET enabled = 0 WHERE channel_url = ?;
```

Also set `MESSENGER_ENABLED=false` only if realtime must be stopped globally. The route will render no unlisted groups after the policy is disabled. Do not delete the fresh channel, archive, messages, corpora, or evidence during incident rollback.

## 17. Final decision

The prior architectural blockers—scattered policy, cross-channel parent/reaction IDs, public fixed-membership semantics, live public rooms, hardcoded personas, unscoped RAG, immediate bot cascades, thread completion, and the `/home/feed` redirect collision—are addressed in code.

Production data and the path-only beta entrance are ready. The code is ready to deploy with autonomous posting off. The only hard activation blockers are the undeployed working-tree image, an explicitly provisioned provider credential, and the post-deploy authorization/realtime/manual-thread checks above. RAG remains intentionally empty and is not a blocker.
