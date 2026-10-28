# Language subdomains ranking in English search (tgl., swe., …)

**Date:** 2026-10-28 · Evidence: Clicky (last 7 days, Oct 22–28), live crawler-view tests of every language host. Search Console is not connected on the dev machine, so index counts are inferred from Clicky entrances, not from Google's index report.

## Symptom
Search entrances landing on non-English hosts: `tgl.` 84 of 883 (9.5%), `swe.` 20 (2.3%), `livredemormon.fr` 5, `buchmormon.de` 1, vs `bookofmormon.online` 773. The tgl landings are almost all `/matters/*` and `/commentary/*`: English text on a Tagalog domain.

## Root cause
Every language host serves the same page set as the English host, indexable, with a self-referencing canonical, a full-site sitemap (2,830 URLs on tgl/swe, 2,831 on ko) and an hreflang cluster that claims all nine languages exist for every URL. But only part of the site is actually translated:

| Route class | Translated on language hosts? |
|---|---|
| `/contents`, home labels, UI | yes (all) |
| content-tree pages `/{page}/{n}` (scripture text) | yes (ru, sv, ko verified; commentary block under the text stays English) |
| `/people` (name/title/description) | ko only; others: subtitle only |
| `/places`, `/matters`, `/commentary`, `/fax`, `/map`, `/timeline`, `/history` | no (English text; ratio of words shared with English page 0.9–1.0) |
| `/read/*` | English on every host; already canonicalised to the English URL and left out of non-English sitemaps (the existing precedent) |

2,296 of ~2,830 sitemap URLs per language host (81%) are English-only classes. Google sees the same English document at up to nine URLs, each self-canonical, and picks one per query. Only `sl`/`tr` hosts are noindexed today.

Aggravating factor: Matters went crawlable on 2026-10-23 (`9f9a67ae`), adding 480 more English-only URLs to each language sitemap. The tgl matters entrances in the data are that change showing up.

## Fix (recommended, not yet built)
1. A per-language table of routes that really have native content (`NATIVE_ROUTES`: contents, content-tree pages, home; ko also people).
2. For any other route on a non-English host: `canonical` → the English URL, no hreflang cluster, absent from that host's sitemap. Same treatment `/read` already gets.
3. Keep the hreflang cluster only for native routes.
4. Tests: per host × route class assertions on canonical/hreflang/sitemap; sitemap size per host.
5. After deploy: submit sitemaps, watch Clicky entrances by host for 2–3 weeks.
