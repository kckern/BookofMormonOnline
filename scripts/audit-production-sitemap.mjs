#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'

const BASE = process.env.AUDIT_BASE_URL || 'https://bookofmormon.online'
const SITEMAP = process.env.AUDIT_SITEMAP_URL || `${BASE}/sitemap.xml`
const CONCURRENCY = Math.max(1, Number(process.env.AUDIT_CONCURRENCY || 4))
const TIMEOUT_MS = Math.max(1_000, Number(process.env.AUDIT_TIMEOUT_MS || 45_000))
const OUTPUT = process.env.AUDIT_OUTPUT || `/tmp/bom-production-seo-audit-${Date.now()}.json`
const USER_AGENT = process.env.AUDIT_USER_AGENT || 'BOMProductionAudit/1.0 bot (+https://bookofmormon.online/)'

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || null
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || []
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const started = performance.now()
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': USER_AGENT,
        },
      })
      const body = await response.text()
      const durationMs = Math.round(performance.now() - started)
      clearTimeout(timeout)
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
        continue
      }
      return { response, body, durationMs, attempts: attempt }
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
      }
    }
  }
  throw lastError
}

function inspectPage(requestedUrl, response, html, durationMs, attempts) {
  const title = stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  const h1 = stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')
  const canonicalTag = tags(html, 'link').find((tag) => (attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical'))
  const canonical = canonicalTag ? attribute(canonicalTag, 'href') : null
  const hreflangs = tags(html, 'link')
    .map((tag) => ({ rel: attribute(tag, 'rel'), lang: attribute(tag, 'hreflang'), href: attribute(tag, 'href') }))
    .filter(({ rel, lang, href }) => rel?.toLowerCase().split(/\s+/).includes('alternate') && lang && href)
  const robots = [
    response.headers.get('x-robots-tag') || '',
    ...tags(html, 'meta')
      .filter((tag) => ['robots', 'googlebot'].includes((attribute(tag, 'name') || '').toLowerCase()))
      .map((tag) => attribute(tag, 'content') || ''),
  ].join(',').toLowerCase()
  const jsonLdBlocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  let jsonLdInvalid = 0
  for (const block of jsonLdBlocks) {
    try {
      JSON.parse(block[1])
    } catch {
      jsonLdInvalid += 1
    }
  }

  const requested = new URL(requestedUrl)
  let canonicalValid = false
  let canonicalMatches = false
  if (canonical) {
    try {
      const parsed = new URL(canonical)
      canonicalValid = parsed.protocol === 'https:' && parsed.hostname.endsWith('bookofmormon.online')
      canonicalMatches = parsed.origin === requested.origin && parsed.pathname === requested.pathname
    } catch {
      canonicalValid = false
    }
  }
  const hreflangExpected = !requested.pathname.startsWith('/read/') && requested.pathname !== '/%ED%8A%B9%EB%B3%84%EB%B0%98'

  const issues = []
  if (response.status !== 200) issues.push(`status_${response.status}`)
  // The render-mode header is diagnostic, not the SEO contract. Cloudflare may
  // still hold a valid SSR document cached before that header was introduced.
  // Treat the page as a routing failure only when both the header and the
  // crawler-visible semantic document are absent.
  if (response.headers.get('x-bom-render-mode') !== 'ssr' && (!title || !canonical || Buffer.byteLength(html) < 1_000)) {
    issues.push('not_ssr')
  }
  if (!response.headers.get('content-type')?.includes('text/html')) issues.push('not_html')
  if (Buffer.byteLength(html) < 1_000) issues.push('small_body')
  if (!title) issues.push('missing_title')
  if (!h1) issues.push('missing_h1')
  if (!canonical) issues.push('missing_canonical')
  else if (!canonicalValid) issues.push('invalid_canonical')
  else if (!canonicalMatches) issues.push('canonical_mismatch')
  if (robots.includes('noindex')) issues.push('unexpected_noindex')
  if (hreflangExpected && hreflangs.length === 0) issues.push('missing_hreflang')
  if (jsonLdInvalid) issues.push('invalid_jsonld')

  return {
    url: requestedUrl,
    finalUrl: response.url,
    status: response.status,
    renderMode: response.headers.get('x-bom-render-mode'),
    clientClass: response.headers.get('x-bom-client-class'),
    contentType: response.headers.get('content-type'),
    bytes: Buffer.byteLength(html),
    durationMs,
    attempts,
    title,
    h1,
    canonical,
    canonicalMatches,
    noindex: robots.includes('noindex'),
    hreflangCount: hreflangs.length,
    jsonLdCount: jsonLdBlocks.length,
    jsonLdInvalid,
    issues,
  }
}

async function main() {
  const sitemapResult = await fetchWithRetry(SITEMAP)
  if (!sitemapResult.response.ok) {
    throw new Error(`Sitemap returned ${sitemapResult.response.status}`)
  }
  const urls = [...sitemapResult.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1].trim()))
  if (!urls.length) throw new Error('Sitemap contained no URLs')

  console.log(`Auditing ${urls.length} URLs from ${SITEMAP} at concurrency ${CONCURRENCY}`)
  const results = new Array(urls.length)
  let cursor = 0
  let completed = 0

  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= urls.length) return
      const url = urls[index]
      try {
        const { response, body, durationMs, attempts } = await fetchWithRetry(url)
        results[index] = inspectPage(url, response, body, durationMs, attempts)
      } catch (error) {
        results[index] = { url, issues: ['fetch_error'], error: String(error) }
      }
      completed += 1
      if (completed % 50 === 0 || completed === urls.length) {
        const issueCount = results.filter(Boolean).filter((result) => result.issues?.length).length
        console.log(`${completed}/${urls.length} complete; ${issueCount} URLs with findings`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const findings = {}
  for (const result of results) {
    for (const issue of result.issues || []) findings[issue] = (findings[issue] || 0) + 1
  }
  const durations = results.map((result) => result.durationMs).filter(Number.isFinite).sort((a, b) => a - b)
  const percentile = (p) => durations[Math.min(durations.length - 1, Math.floor(durations.length * p))] || null
  const summary = {
    generatedAt: new Date().toISOString(),
    sitemap: SITEMAP,
    total: urls.length,
    clean: results.filter((result) => result.issues?.length === 0).length,
    urlsWithFindings: results.filter((result) => result.issues?.length).length,
    missingRenderModeHeader: results.filter((result) => result.renderMode !== 'ssr').length,
    findings,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: durations.at(-1) || null },
  }
  await writeFile(OUTPUT, `${JSON.stringify({ summary, results }, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Raw results: ${OUTPUT}`)
  if (findings.fetch_error || findings.status_500 || findings.status_502 || findings.status_503 || findings.status_504) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
