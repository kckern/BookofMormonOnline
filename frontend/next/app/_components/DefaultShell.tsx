import { headers } from 'next/headers'
import { DEFAULT_NAV, getSiteChrome } from '@/lib/seo'
import { label } from '@/lib/labels'

// Nav href → CRA label key (labels localize the visible text; hrefs are stable).
const NAV_LABEL_KEY: Record<string, string> = {
  '/contents': 'menu_contents', '/timeline': 'menu_timeline', '/map': 'menu_map',
  '/people': 'menu_people', '/places': 'menu_places', '/fax': 'menu_fax', '/about': 'menu_about',
}

// The generic crawlable shell the PHP box serves for the homepage and any route
// without a specific handler (e.g. /search, /user, /objects).
export async function DefaultShell() {
  const lang = (await headers()).get('x-lang') ?? 'en'
  const { defaultTitle, defaultBody } = await getSiteChrome()
  const nav = await Promise.all(
    DEFAULT_NAV.map(async (item) => ({
      href: item.href,
      label: lang === 'en' ? item.label : await label(NAV_LABEL_KEY[item.href] ?? '', item.label),
    })),
  )
  return (
    <>
      <h1>{defaultTitle}</h1>
      <p>{defaultBody}</p>
      <ul>
        {nav.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </>
  )
}
