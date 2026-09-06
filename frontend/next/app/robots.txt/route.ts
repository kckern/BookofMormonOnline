import { headers } from 'next/headers'
import { LANG_HOST } from '@/lib/locales'

export const dynamic = 'force-dynamic'

export async function GET() {
  const lang = (await headers()).get('x-lang') ?? 'en'
  const host = LANG_HOST[lang]
  const body = 'User-agent: *\nDisallow:\n' + (host ? `Sitemap: https://${host}/sitemap.xml\n` : '')
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
