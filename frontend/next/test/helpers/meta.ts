// Parse OG/Twitter meta tags from raw HTML strings.
// Works on both property="og:*" and name="twitter:*" forms.

export function getMeta(html: string, key: string): string | null {
  // <meta property="og:title" content="..."> or  <meta name="..." content="...">
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRe(key)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRe(key)}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}

export function getTitle(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  return m?.[1] ?? null
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
