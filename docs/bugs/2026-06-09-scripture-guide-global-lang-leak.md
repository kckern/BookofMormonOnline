# scripture-guide global language leaks across requests — English users get Korean references

**Symptom:** English (`/en`) GraphQL responses intermittently contain Korean generated
scripture references (e.g. commentary `reference: "니파이전서 1장 1절"`, chiasmus
references, queue `next` refs) after the same backend process has served any Korean
request. Found while capturing regression baselines: 11 of 95 `en` baseline files came
back contaminated during an interleaved en/ko capture run; reproduced live by POSTing
`/ko` then `/en` `passagenotes` against `localhost:5005`. Affects prod too (prod-captured
`places`, `chiasm`, `chiasmus`, `queue` files were contaminated) — any visitor on the
Korean domain poisons subsequent English visitors' references until the state flips back.

**Root cause:** `scripture-guide` keeps a module-global current language set via
`setLang()`. The backend mutates that global per request and inconsistently:

- `src/resolvers/BomScripture.ts:10` — `setLang((lang || "en") as LanguageCode)` on every
  scripture query (sets it both ways).
- `src/resolvers/BomPeoplePlace.ts:505` — `if (lang !== 'en') setLang(lang)` — sets it for
  non-English but **never resets it for English**, so the global sticks at the last
  non-en value.
- `src/resolvers/BomNotes.ts:149,361,426` — call `generateReference(...)` with **no
  language handling at all**, inheriting whatever the previous request left in the global.

One Node process serves every language (path-mounted `/en`, `/ko`, …), so the global is
shared mutable state across requests.

**Fix sketch:** stop using the global entirely — pass the language per call,
`generateReference(verse_ids, lang)`, as `src/resolvers/lib.ts:322` already does. Audit
all `generateReference`/`lookup` call sites in resolvers; remove `setLang` imports.
Planned as part of the resolver overhaul.

**Regression-suite handling (interim):** `tests/harness/runner.js` sends a trivial
language-priming scripture query to the target immediately before every case, forcing the
global to the case's language; baselines therefore freeze steady-state per-language
behavior and stay valid after the bug is fixed (a fixed backend returns the same
steady-state responses without needing the primer).

**Regression test:** any `en` content case in `npm run test:gql` (e.g.
`passagenotes.batch [en]`) — would fail on reference-language mismatch if the leak
recurs in a form the primer can't mask, and the primer can be removed once the backend
passes lang per call.

**Status:** FIXED 2026-06-09 (commit 1c81d34) — lang passed per call, `setLang` removed
repo-wide. Prod remains affected until the next deploy; the suite's language primer stays
in place for prod verification.
