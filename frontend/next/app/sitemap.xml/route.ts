import { headers } from 'next/headers'
import { getSitemapUrls, CHANGEFREQ, LASTMOD } from '@/lib/sitemap'
import { LANG_HOST, bcp47, safeHost } from '@/lib/locales'

// Serve /sitemap.xml as a hand-rendered XML string rather than via Next's
// MetadataRoute.Sitemap convention: the benchmark's <priority> values are exact
// decimal strings ('1.0', '0.8', … '0.1') and Next's serializer would normalise
// 1.0 → '1'. Emitting the XML directly guarantees byte-equal priority fields and
// the benchmark's <loc>/<lastmod>/<changefreq>/<priority> element order.

// Force dynamic so Next doesn't attempt to pre-render at build time.
// The sitemap fetches live data from the backend via GraphQL; during image
// build there is no backend running. CDN/Cloudflare cache handles freshness.
export const dynamic = 'force-dynamic'

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET() {
  const h = await headers()
  const lang = h.get('x-lang') ?? 'en'
  const canonicalHost = LANG_HOST[lang]
  // Slovenian/Turkish are deliberately noindex until their data layers are
  // localized. Serve a valid empty sitemap rather than advertising duplicates.
  const urls = canonicalHost ? await getSitemapUrls() : []
  const origin = `https://${canonicalHost ?? safeHost(h.get('x-forwarded-host') ?? h.get('host'))}`
  const body = urls
    .map(({ path, priority }) => ({
      path: path === '/studyedition'
        ? (lang === 'ko' ? '/특별반' : null)
        : path.startsWith('/read/') && lang !== 'en'
          ? null
          : path,
      priority,
    }))
    .filter((row): row is { path: string; priority: string } => row.path !== null)
    .map(
      ({ path, priority }) =>
        '    <url>\n' +
        `        <loc>${xmlEscape(new URL(path, origin).toString())}</loc>\n` +
        (path === '/특별반'
          ? `        <xhtml:link rel="alternate" hreflang="ko" href="${xmlEscape(new URL(path, origin).toString())}"/>\n`
          : path.startsWith('/read/')
            ? `        <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(new URL(path, `https://${LANG_HOST.en}`).toString())}"/>\n` +
              `        <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(new URL(path, `https://${LANG_HOST.en}`).toString())}"/>\n`
          : Object.entries(LANG_HOST)
              .map(([code, host]) => `        <xhtml:link rel="alternate" hreflang="${bcp47(code)}" href="${xmlEscape(new URL(path, `https://${host}`).toString())}"/>\n`)
              .join('') + `        <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(new URL(path, `https://${LANG_HOST.en}`).toString())}"/>\n`) +
        `        <lastmod>${LASTMOD}</lastmod>\n` +
        `        <changefreq>${CHANGEFREQ}</changefreq>\n` +
        `        <priority>${priority}</priority>\n` +
        '    </url>',
    )
    .join('\n')

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    body +
    '\n</urlset>\n'

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
