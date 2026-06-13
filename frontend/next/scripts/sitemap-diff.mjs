#!/usr/bin/env node
// Compare our /sitemap.xml against the PHP box benchmark: URL set + per-URL
// priority/changefreq/lastmod. Reports missing/extra URLs and field mismatches.

const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BENCH = process.env.BENCH ?? 'https://bookofmormon.online'
const OURS = process.env.OURS ?? 'http://localhost:8200'

function parse(xml) {
  const map = new Map()
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const blk = m[1]
    const g = (t) => blk.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]
    const loc = g('loc')
    if (!loc) continue
    const path = (() => { try { return new URL(loc).pathname } catch { return loc } })()
    map.set(path, { priority: g('priority'), changefreq: g('changefreq'), lastmod: g('lastmod') })
  }
  return map
}

async function get(base) {
  const r = await fetch(base + '/sitemap.xml', { headers: { 'User-Agent': BOT_UA } })
  return { status: r.status, type: r.headers.get('content-type'), xml: await r.text() }
}

const [b, o] = await Promise.all([get(BENCH), get(OURS)])
console.log(`bench HTTP ${b.status} (${b.type})   ours HTTP ${o.status} (${o.type})`)
const bm = parse(b.xml), om = parse(o.xml)
console.log(`bench urls: ${bm.size}   ours urls: ${om.size}\n`)

const cat = (p) => {
  const s = p.split('/').filter(Boolean)
  if (p === '/') return '(root)'
  if (['history', 'people', 'place', 'places', 'fax', 'map', 'contents'].includes(s[0])) return `${s[0]} d${s.length}`
  return `pageslug d${s.length}`
}

const missing = [...bm.keys()].filter((k) => !om.has(k))
const extra = [...om.keys()].filter((k) => !bm.has(k))

// Group missing/extra by category for a readable summary.
const group = (arr) => {
  const g = {}
  for (const p of arr) { const c = cat(p); (g[c] ??= []).push(p) }
  return g
}
if (missing.length) {
  console.log(`MISSING (${missing.length}) — in bench, not ours:`)
  const g = group(missing)
  for (const c of Object.keys(g).sort()) console.log(`  ${c}: ${g[c].length}   e.g. ${g[c].slice(0, 3).join(', ')}`)
}
if (extra.length) {
  console.log(`EXTRA (${extra.length}) — in ours, not bench:`)
  const g = group(extra)
  for (const c of Object.keys(g).sort()) console.log(`  ${c}: ${g[c].length}   e.g. ${g[c].slice(0, 3).join(', ')}`)
}

let fieldMiss = 0
for (const [p, bv] of bm) {
  const ov = om.get(p)
  if (!ov) continue
  for (const f of ['priority', 'changefreq', 'lastmod']) {
    if ((bv[f] ?? '') !== (ov[f] ?? '')) {
      fieldMiss++
      if (fieldMiss <= 20) console.log(`  field ${f} @ ${p}: bench=${bv[f]} ours=${ov[f]}`)
    }
  }
}

const ok = !missing.length && !extra.length && !fieldMiss
console.log(`\n${ok ? 'SITEMAP PARITY: identical url set + fields' : `MISMATCH: ${missing.length} missing, ${extra.length} extra, ${fieldMiss} field diffs`}`)
process.exitCode = ok ? 0 : 1
