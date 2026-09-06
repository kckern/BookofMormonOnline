#!/usr/bin/env node

const mode = process.argv.includes('--full') ? 'full' : 'smoke'
const concurrency = Number(process.env.METADATA_AUDIT_CONCURRENCY ?? 8)
const supportedHosts = [
  'bookofmormon.online', 'xn--289a67xla.kr', 'libromormon.es', 'livredemormon.fr',
  'buchmormon.de', 'swe.bookofmormon.online', 'sachmacmon.vn',
  'xn--80aahtjpadfibw.net', 'tgl.bookofmormon.online',
]
const unsupportedHosts = ['mormonovaknjiga.si', 'tr.bookofmormon.online']
const htmlLang = {
  'bookofmormon.online': 'en', 'xn--289a67xla.kr': 'ko', 'libromormon.es': 'es',
  'livredemormon.fr': 'fr', 'buchmormon.de': 'de', 'swe.bookofmormon.online': 'sv',
  'sachmacmon.vn': 'vi', 'xn--80aahtjpadfibw.net': 'ru', 'tgl.bookofmormon.online': 'tl',
}
const smokePaths = [
  '/', '/contents', '/about', '/lehites', '/lehites/lehis-prophetic-call',
  '/people', '/people/nephi1', '/places', '/place/jerusalem-1', '/map',
  '/map/neareast', '/map/neareast/place/assyria', '/timeline',
  '/timeline/lehite-family', '/fax', '/fax/original', '/art/1000',
  '/commentary/1012904101', '/read/alma.32', '/search', '/history',
  '/studyedition',
]
const ua = 'BookofMormonOnline-Metadata-Audit/1.0'

function meta(html, key) {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const tagKey = tag.match(/(?:name|property)=["']([^"']+)/i)?.[1]
    if (tagKey === key) return tag.match(/content=["']([^"']*)/i)?.[1] ?? ''
  }
  return null
}

function canonical(html) {
  for (const tag of html.match(/<link\s+[^>]*>/gi) ?? []) {
    if (tag.match(/rel=["']([^"']+)/i)?.[1] === 'canonical') {
      return tag.match(/href=["']([^"']*)/i)?.[1] ?? ''
    }
  }
  return null
}

async function pathsFor(host) {
  if (mode === 'smoke') return smokePaths
  const response = await fetch(`https://${host}/sitemap.xml`, { headers: { 'user-agent': ua } })
  if (!response.ok) throw new Error(`${host}/sitemap.xml returned ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname)
}

async function inspect(host, path, unsupported = false) {
  const response = await fetch(`https://${host}${path}`, {
    headers: { 'user-agent': ua, accept: 'text/html' },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
  if (path === '/studyedition' && response.status === 301) {
    const location = response.headers.get('location') ?? ''
    return location === 'https://xn--289a67xla.kr/%ED%8A%B9%EB%B3%84%EB%B0%98'
      ? []
      : [`${host}${path}: wrong Study Edition redirect ${location}`]
  }
  if (response.status !== 200) return [`${host}${path}: HTTP ${response.status}`]
  const html = await response.text()
  const issues = []
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? ''
  const description = meta(html, 'description')
  const canon = canonical(html)
  const ogUrl = meta(html, 'og:url')
  const required = {
    title, description, canonical: canon, 'og:title': meta(html, 'og:title'),
    'og:description': meta(html, 'og:description'), 'og:url': ogUrl,
    'og:image': meta(html, 'og:image'), 'og:image:alt': meta(html, 'og:image:alt'),
    'twitter:title': meta(html, 'twitter:title'),
    'twitter:description': meta(html, 'twitter:description'),
    'twitter:image': meta(html, 'twitter:image'),
    'twitter:image:alt': meta(html, 'twitter:image:alt'),
  }
  for (const [key, value] of Object.entries(required)) if (!value) issues.push(`${host}${path}: missing ${key}`)
  if (canon && !canon.startsWith('https://')) issues.push(`${host}${path}: non-HTTPS canonical ${canon}`)
  if (ogUrl && !ogUrl.startsWith('https://')) issues.push(`${host}${path}: non-HTTPS og:url ${ogUrl}`)
  if (canon && ogUrl && canon !== ogUrl) issues.push(`${host}${path}: canonical does not equal og:url`)
  const robots = (meta(html, 'robots') ?? '').toLowerCase()
  if (unsupported && !robots.includes('noindex')) issues.push(`${host}${path}: unsupported locale is indexable`)
  if ((path === '/search' || path === '/history') && !robots.includes('noindex')) issues.push(`${host}${path}: expected noindex`)
  const declaredLang = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1]
  if (!unsupported && declaredLang !== htmlLang[host]) issues.push(`${host}${path}: html lang ${declaredLang ?? '(missing)'}`)
  const indexable = !robots.includes('noindex')
  if (indexable && !path.startsWith('/read/')) {
    const hreflangs = [...html.matchAll(/<link[^>]+hreflang=["']([^"']+)/gi)].map((match) => match[1].toLowerCase())
    for (const requiredLang of ['en', 'ko', 'es', 'fr', 'de', 'sv', 'vi', 'ru', 'tl', 'x-default']) {
      if (!hreflangs.includes(requiredLang)) issues.push(`${host}${path}: missing hreflang ${requiredLang}`)
    }
  }
  if (indexable) {
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    if (!blocks.length) issues.push(`${host}${path}: missing JSON-LD`)
    for (const block of blocks) {
      try { JSON.parse(block[1]) } catch { issues.push(`${host}${path}: invalid JSON-LD`) }
    }
  }
  if (mode === 'smoke' && required['og:image']) {
    const imageResponse = await fetch(required['og:image'], { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(20_000) })
    if (!imageResponse.ok || !(imageResponse.headers.get('content-type') ?? '').startsWith('image/')) {
      issues.push(`${host}${path}: OG image returned ${imageResponse.status} ${imageResponse.headers.get('content-type') ?? ''}`)
    }
  }
  return issues
}

async function main() {
  const jobs = []
  for (const host of supportedHosts) for (const path of await pathsFor(host)) jobs.push({ host, path, unsupported: false })
  if (mode === 'smoke') for (const host of unsupportedHosts) jobs.push({ host, path: '/', unsupported: true })
  let cursor = 0
  const issues = []
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try { issues.push(...await inspect(job.host, job.path, job.unsupported)) }
      catch (error) { issues.push(`${job.host}${job.path}: ${error.message}`) }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  if (issues.length) {
    console.error(issues.slice(0, 200).join('\n'))
    if (issues.length > 200) console.error(`…and ${issues.length - 200} more`)
    process.exitCode = 1
    return
  }
  console.log(`Metadata audit passed: ${jobs.length} URLs (${mode})`)
}

await main()
