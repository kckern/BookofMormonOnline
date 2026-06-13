#!/usr/bin/env node
// Parity harness: compare our Next.js SSR (bot path) against the live PHP box benchmark.
//
// Usage:
//   node scripts/parity.mjs                 # default route set
//   node scripts/parity.mjs /lehites/64 /lehites    # specific paths
//   BENCH=https://bookofmormon.online OURS=http://localhost:8200 node scripts/parity.mjs
//
// The PHP box output is the spec. For each path we fetch both sides with a bot
// User-Agent and diff the SEO-relevant head fields plus a normalized body-text digest.
// og:image / twitter:image hosts legitimately differ (we replace the GD preview
// service with next/og), so those are compared by presence + dimensions, not host.

const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BENCH = process.env.BENCH ?? 'https://bookofmormon.online'
const OURS = process.env.OURS ?? 'http://localhost:8200'

const DEFAULT_PATHS = [
  '/',
  '/lehites',
  '/lehites/64',
  '/people/nephi1',
  '/place/jerusalem-1',
  '/places/jerusalem-1',
  '/contents',
  '/about',
  '/maps',
  '/history',
  '/search', // default-fallback route
]

const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PATHS

async function fetchHtml(base, path) {
  try {
    const res = await fetch(base + path, { headers: { 'User-Agent': BOT_UA }, redirect: 'manual' })
    const body = await res.text()
    return { status: res.status, body }
  } catch (e) {
    return { status: 0, body: '', error: String(e) }
  }
}

const pick = (re, html) => {
  const m = html.match(re)
  return m ? m[1].trim() : null
}

function extract(html) {
  return {
    title: pick(/<title>([^<]*)<\/title>/i, html),
    description: pick(/<meta\s+name="description"\s+content="([^"]*)"/i, html),
    ogTitle: pick(/<meta\s+property="og:title"\s+content="([^"]*)"/i, html),
    ogDescription: pick(/<meta\s+property="og:description"\s+content="([^"]*)"/i, html),
    ogUrl: pick(/<meta\s+property="og:url"\s+content="([^"]*)"/i, html),
    ogType: pick(/<meta\s+property="og:type"\s+content="([^"]*)"/i, html),
    ogImageW: pick(/<meta\s+property="og:image:width"\s+content="([^"]*)"/i, html),
    ogImageH: pick(/<meta\s+property="og:image:height"\s+content="([^"]*)"/i, html),
    ogImagePresent: /<meta\s+property="og:image"\s+content="[^"]+"/i.test(html) ? 'yes' : 'no',
    twCard: pick(/<meta\s+name="twitter:card"\s+content="([^"]*)"/i, html),
    twSite: pick(/<meta\s+name="twitter:site"\s+content="([^"]*)"/i, html),
    twTitle: pick(/<meta\s+name="twitter:title"\s+content="([^"]*)"/i, html),
    twDescription: pick(/<meta\s+name="twitter:description"\s+content="([^"]*)"/i, html),
    canonical: pick(/<link\s+rel="canonical"\s+href="([^"]*)"/i, html),
    // Normalized body-text digest: strip tags + collapse whitespace, first 400 chars.
    bodyText: bodyDigest(html),
  }
}

function bodyDigest(html) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? ''
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

// Host-insensitive compare for url fields: compare path + query only.
const pathOf = (u) => { try { const x = new URL(u); return x.pathname + x.search } catch { return u } }

const C = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` }

let totalFields = 0, totalMatch = 0
const failures = []

for (const path of paths) {
  const [b, o] = await Promise.all([fetchHtml(BENCH, path), fetchHtml(OURS, path)])
  console.log(C.bold(`\n##### ${path}`))
  console.log(`  bench HTTP ${b.status}${b.error ? ' ' + b.error : ''}   ours HTTP ${o.status}${o.error ? ' ' + o.error : ''}`)

  // PHP box returns 500 for some bad refs — parity means we may legitimately differ
  // (we 404 or fall back). Note it and skip field diff.
  if (b.status >= 500) {
    console.log(C.dim(`  benchmark itself returns ${b.status} — skipping field comparison`))
    continue
  }

  const be = extract(b.body)
  const oe = extract(o.body)

  const fields = Object.keys(be).filter((k) => k !== 'bodyText')
  for (const f of fields) {
    totalFields++
    let bv = be[f], ov = oe[f]
    let match
    if (f === 'ogUrl' || f === 'canonical') {
      match = pathOf(bv ?? '') === pathOf(ov ?? '')
    } else {
      // Normalize whitespace: the PHP box emits raw CR/newlines in meta values
      // that Cloudflare minify (and crawlers) collapse — immaterial for parity.
      const ws = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
      match = ws(bv) === ws(ov)
    }
    if (match) { totalMatch++; continue }
    console.log(`  ${C.red('✗')} ${f}`)
    console.log(C.dim(`      bench: ${bv ?? '(missing)'}`))
    console.log(C.dim(`      ours:  ${ov ?? '(missing)'}`))
    failures.push(`${path} :: ${f}`)
  }

  // Body-text similarity (informational): how much of bench digest we cover.
  const bd = be.bodyText ?? '', od = oe.bodyText ?? ''
  const sameStart = bd && od && od.slice(0, 80) === bd.slice(0, 80)
  console.log(`  ${sameStart ? C.green('≈') : C.red('≠')} body-start ${sameStart ? 'matches' : 'differs'}`)
  if (!sameStart) {
    console.log(C.dim(`      bench: ${bd.slice(0, 120)}`))
    console.log(C.dim(`      ours:  ${od.slice(0, 120)}`))
  }
}

console.log(C.bold(`\n===== ${totalMatch}/${totalFields} head fields match across ${paths.length} routes =====`))
if (failures.length) {
  console.log(C.red(`${failures.length} field mismatches`))
  process.exitCode = 1
} else {
  console.log(C.green('all head fields match'))
}
