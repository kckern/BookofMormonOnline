#!/usr/bin/env node
// Compare the rendered <body> of our SSR against the PHP box, ignoring Next.js
// hydration noise (RSC __next_f scripts, template/comment markers). Emits the
// normalized DOM-ish token stream for both and a unified line diff.

const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BENCH = process.env.BENCH ?? 'https://bookofmormon.online'
const OURS = process.env.OURS ?? 'http://localhost:8200'
const path = process.argv[2] ?? '/lehites/64'

async function get(base) {
  const res = await fetch(base + path, { headers: { 'User-Agent': BOT_UA } })
  return res.text()
}

// Extract body, strip scripts/styles/comments/next templates, normalize tags to
// a line-per-element token stream so structural diffs are readable.
function normalize(html) {
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<template[\s\S]*?<\/template>/gi, '')
    .replace(/<!--.*?-->/g, '')
    .replace(/\s(data-[\w-]+|class|id|nonce|fetchpriority|crossorigin)="[^"]*"/gi, '') // drop framework attrs
    .replace(/<(link|meta)\b[^>]*>/gi, '') // drop injected head-ish tags in body
    // Next.js App Router streams metadata into the body tail (browser hoists it):
    // a duplicate <title> and empty <div hidden> boundary pairs. Not real content.
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<div hidden>\s*<\/div>/gi, '')
  // tokenize: put each tag on its own line
  return body
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

const [b, o] = await Promise.all([get(BENCH), get(OURS)])
const bn = normalize(b).split('\n')
const on = normalize(o).split('\n')

console.log(`### ${path}\nbench lines: ${bn.length}   ours lines: ${on.length}\n`)
const max = Math.max(bn.length, on.length)
let diffs = 0
for (let i = 0; i < max; i++) {
  const bl = bn[i] ?? ''
  const ol = on[i] ?? ''
  if (bl === ol) continue
  diffs++
  if (diffs <= 40) {
    console.log(`L${i}`)
    console.log(`  bench: ${bl.slice(0, 160)}`)
    console.log(`  ours:  ${ol.slice(0, 160)}`)
  }
}
console.log(diffs ? `\n${diffs} differing lines` : '\nbodies identical (normalized)')
