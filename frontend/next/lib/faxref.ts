// Pure helpers for /fax/:edition/:page share URLs (no React/GraphQL; unit-testable).

// "1.nephi.3.7" -> "1 Nephi 3:7"; "alma.32" -> "Alma 32". Null when it isn't a ref.
export function refFromSlug(s: string): string | null {
  const m = s.match(/^(.*?[a-z].*?)\.(\d+)(?:\.(\d+(?:~\d+)?))?$/i)
  if (!m) return null
  const book = m[1].split('.').map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
  return m[3] ? `${book} ${m[2]}:${m[3].replace('~', '–')}` : `${book} ${m[2]}`
}

