#!/usr/bin/env node
/**
 * Full-selection A/B sweep of EVERY page, legacy(:5005) vs green-field(:5006),
 * en+ko. Diff lines under `quotes` are classified separately: quote order is
 * an approved contract divergence (docs/bugs/2026-06-09-quote-order-scrambled.md).
 * Exit 1 only on NON-quote differences.
 */
const LEGACY = process.env.LEGACY_URL ?? 'http://localhost:5005';
const NEXT = process.env.NEXT_URL ?? 'http://localhost:5006';

const SELECTION = `{title slug sections{title slug rows{weight type narration{description text{guid slug heading content chrono duration quotes{parent parentSlug slug heading content duration} people{slug name title} places{slug name info} refs{verse_id ref type significant} notes{id title text}}} connection{isPage type text slug} capsulation{description reference slug}}}}`;

async function post(base, lang, query) {
  const res = await fetch(`${base}/${lang}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (Array.isArray(body.errors)) {
    body.errors = [...new Set(body.errors.map((e) => e?.message ?? JSON.stringify(e)))]
      .sort()
      .map((message) => ({ message }));
  }
  return body;
}

// Arrays whose ORDER legacy derives from engine artifacts (approved contract
// changes — the page type is next-truth): order-only differences are fine,
// value/set differences are not.
const ORDER_APPROVED = /\.(quotes|places)$/;

const sortedJson = (arr) =>
  JSON.stringify([...arr].map((x) => JSON.stringify(x)).sort());

function diffPaths(a, b, path = '$', out = []) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (ORDER_APPROVED.test(path) && sortedJson(a) === sortedJson(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path}: order-only (approved)`);
      return out;
    }
    if (a.length !== b.length) out.push(`${path}: array length ${a.length} vs ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) diffPaths(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${path}.${k}: only in next`);
      else if (!(k in b)) out.push(`${path}.${k}: only in legacy`);
      else diffPaths(a[k], b[k], `${path}.${k}`, out);
    }
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${path}: differs`);
  return out;
}

const tree = await post(NEXT, 'en', '{division{slug pages{slug}}}');
const pageSlugs = tree.data.division.flatMap((d) => d.pages.map((p) => p.slug.split('/').pop()));
console.log(`Sweeping ${pageSlugs.length} pages × en,ko ...`);

let clean = 0;
let quoteOnly = 0;
const problems = [];
for (const slug of pageSlugs) {
  for (const lang of ['en', 'ko']) {
    const query = `{page(slug:"${slug}")${SELECTION}}`;
    const [legacy, next] = await Promise.all([post(LEGACY, lang, query), post(NEXT, lang, query)]);
    if (JSON.stringify(legacy) === JSON.stringify(next)) {
      clean += 1;
      continue;
    }
    const diffs = diffPaths(legacy, next);
    const nonQuote = diffs.filter((d) => !/order-only \(approved\)/.test(d));
    if (nonQuote.length === 0) {
      quoteOnly += 1;
    } else {
      problems.push({ slug, lang, nonQuote: nonQuote.slice(0, 6) });
      console.log(`✕ ${slug} [${lang}]:`);
      for (const d of nonQuote.slice(0, 6)) console.log(`    ${d}`);
    }
  }
}
console.log(`\nidentical: ${clean} · quote-order-only (approved): ${quoteOnly} · problems: ${problems.length}`);
process.exit(problems.length ? 1 : 0);
