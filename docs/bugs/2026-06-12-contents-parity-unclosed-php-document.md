# /contents parity: PHP box emits an unclosed HTML document

**Date:** 2026-06-12
**Route:** `/contents` (Table of Contents) — Next.js SSR parity
**Status:** Implementation complete and byte-correct for the TOC tree; full
`body-diff.mjs` parity is blocked by a PHP-box defect that can only be matched
by changing a shared file (`app/layout.tsx`).

## Summary

`lib/contents.ts` + `app/contents/page.tsx` reproduce the PHP box's Table of
Contents tree **byte-for-byte**. Verified directly: the served
`<div class="toc">…</div>` inner markup is identical to the benchmark's, all
56,763 bytes — every division, page, section, capsule nesting, href, the
two-space `<a  href` vs one-space `<a href`, and the intentionally unbalanced
`</a></li></ul>` tag soup the legacy renderer produced.

`scripts/parity.mjs /contents` passes: **all head fields match**.

`scripts/body-diff.mjs /contents` does **not** reach "bodies identical" — but
the residual is not a tree-content problem. It is three artifacts, all rooted
in the PHP box serving `/contents` as a malformed, unclosed document.

## Root cause

The live PHP box (https://bookofmormon.online/contents, Googlebot UA) returns an
**unclosed document** for this route only:

- No `</body>`, no `</html>`.
- The `<div class="toc">` wrapper is never closed.
- Output ends mid-tree at `…/moroni/finishing-touches…</section>`.

Confirmed against every other route — `/maps`, `/about`, `/people`, `/places`,
`/jaredites`, `/lehites/64`, `/timeline`, `/history` all close `</body></html>`
correctly. Only `/contents` is truncated/unclosed (both the live 58,613-byte
response and the captured `/tmp/bench/contents.html` end the same way, so it is
deterministic, not a transient cutoff).

`body-diff.mjs` extracts `<body[^>]*>([\s\S]*?)</body>`. With no `</body>` the
bench match fails and the script falls back to tokenizing the **whole** HTML,
so the bench token stream begins `<head>`, `</head>`, `<body>`, `<h1>…`. Our
output is a well-formed document (the shared `app/layout.tsx` always emits
`<html><body>…</body></html>`), so our body regex matches and we tokenize
**body-only**, beginning at `<h1>…`. That 3-token head offset cascades into
~900 reported line diffs even though the aligned content is identical.

## Proof the content matches

Aligning both token streams from `<h1>Table of Contents</h1>` and applying the
three document-shape fixes leaves **0 diffs** (1731 == 1731 tokens). The three
fixes are:

1. Prepend `<head>`, `</head>`, `<body>` (bench's full-HTML fallback).
2. The toc `<div>` open tag: bench emits `<div class="toc" >` (note the trailing
   space before `>`); after the harness strips `class`, that is `<div >`. React
   renders `<div class="toc">` → `<div>`. Whitespace-only attribute artifact.
3. Drop the trailing `</div>` (and `</body></html>`): bench never closes the toc
   div; our document does.

Fixes 1 and 3 require our document to be unclosed — i.e. `app/layout.tsx` would
have to conditionally omit `</body></html>` for `/contents`, and the route would
have to render an unclosed `<div class="toc">`. Both are impossible from the two
route-owned files alone. Per the task's standing rule (do not modify shared
files; stop and report instead), no shared file was changed.

Fix 2 is also unbalanceable from the route: matching the trailing space would
require either a className-with-trailing-space (React strips it) or wrapping the
toc string in an extra host div via `dangerouslySetInnerHTML` — which would add
a second `<div>` and a *worse* structural diff. The current code emits exactly
one toc div with the correct class, trading an invisible-whitespace diff for
structural correctness.

## Recommendation

If byte-identical `body-diff` is required for `/contents`, the fix belongs in the
shared SSR shell, not the route: let `app/layout.tsx` (or a per-route override)
emit `/contents` as an unclosed document to mirror the PHP box, OR fix the
upstream PHP box to close its document and re-capture the benchmark. The latter
is preferable — the PHP output is a bug, and every other route proves the rest of
the site closes its documents correctly.

## Files

- `frontend/next/lib/contents.ts` — data layer (division metadata + all pages via
  the `page` root in weight order, capsule slugs from `O` rows; recursive tree).
- `frontend/next/app/contents/page.tsx` — route; renders the tree as a raw HTML
  string to reproduce the PHP template's malformed nesting.

## Key data-model finding (for future TOC work)

The TOC's sub-page nesting is driven by **capsulation rows**, not slug prefixes
or page `parent` (every page's `parent` is its division guid). A section's `rows`
of `type: "O"` carry a `capsulation { slug }` pointing at a sub-page; that page's
section tree renders nested inside the section's `<li>`, recursively. Section
order must come from the `page(slug:)` query (plain weight order) — the
`division.pages[].sections` path uses "textlink" order (textless sections lead),
which reorders e.g. `reign-of-judges/korihor-the-anti-christ` and breaks parity.
