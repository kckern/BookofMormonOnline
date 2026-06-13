import { getSitemapUrls, BASE, CHANGEFREQ, LASTMOD } from '@/lib/sitemap'

// Serve /sitemap.xml as a hand-rendered XML string rather than via Next's
// MetadataRoute.Sitemap convention: the benchmark's <priority> values are exact
// decimal strings ('1.0', '0.8', … '0.1') and Next's serializer would normalise
// 1.0 → '1'. Emitting the XML directly guarantees byte-equal priority fields and
// the benchmark's <loc>/<lastmod>/<changefreq>/<priority> element order.

export const revalidate = 3600

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET() {
  const urls = await getSitemapUrls()
  const body = urls
    .map(
      ({ path, priority }) =>
        '    <url>\n' +
        `        <loc>${xmlEscape(BASE + path)}</loc>\n` +
        `        <lastmod>${LASTMOD}</lastmod>\n` +
        `        <changefreq>${CHANGEFREQ}</changefreq>\n` +
        `        <priority>${priority}</priority>\n` +
        '    </url>',
    )
    .join('\n')

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    body +
    '\n</urlset>\n'

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
