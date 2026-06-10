#!/usr/bin/env node
/**
 * Side-by-side legacy-vs-greenfield comparison.
 *
 *   node scripts/ab-compare.mjs '<graphql query>' [langs]
 *
 * POSTs the identical query to the legacy backend (:5005) and the green-field
 * backend (:5006) for each language (default en,ko) and diffs the JSON bodies.
 * Exit 0 = byte-identical everywhere; exit 1 = any mismatch (first differing
 * paths printed).
 */
const LEGACY = process.env.LEGACY_URL ?? 'http://localhost:5005';
const NEXT = process.env.NEXT_URL ?? 'http://localhost:5006';

const query = process.argv[2];
const langs = (process.argv[3] ?? 'en,ko').split(',');
if (!query) {
  console.error("usage: node scripts/ab-compare.mjs '<graphql query>' [langs]");
  process.exit(2);
}

async function post(base, lang) {
  const res = await fetch(`${base}/${lang}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

function diffPaths(a, b, path = '$', out = [], limit = 10) {
  if (out.length >= limit) return out;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: array length ${a.length} vs ${b.length}`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i += 1) diffPaths(a[i], b[i], `${path}[${i}]`, out, limit);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${path}.${k}: only in next`);
      else if (!(k in b)) out.push(`${path}.${k}: only in legacy`);
      else diffPaths(a[k], b[k], `${path}.${k}`, out, limit);
    }
    return out;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push(`${path}: ${JSON.stringify(a)?.slice(0, 60)} ≠ ${JSON.stringify(b)?.slice(0, 60)}`);
  }
  return out;
}

let failed = false;
for (const lang of langs) {
  const [legacy, next] = await Promise.all([post(LEGACY, lang), post(NEXT, lang)]);
  const identical = JSON.stringify(legacy) === JSON.stringify(next);
  if (identical) {
    console.log(`✓ [${lang}] identical (${JSON.stringify(legacy).length} bytes)`);
  } else {
    failed = true;
    console.log(`✕ [${lang}] DIFFERS:`);
    for (const d of diffPaths(legacy, next)) console.log(`    ${d}`);
  }
}
process.exit(failed ? 1 : 0);
