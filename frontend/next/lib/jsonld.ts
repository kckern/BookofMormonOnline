import { bcp47 } from './locales'

const SITE = 'https://bookofmormon.online'
const IS_PART_OF = { '@type': 'WebSite', name: 'Book of Mormon Online', url: `${SITE}/` }

export interface Crumb {
  name: string
  url: string
}

// schema.org BreadcrumbList from an explicit, data-driven crumb chain (callers
// pass real page names — never raw path segments, so a leaf like /lehites/1 is
// never a "1" crumb).
export function breadcrumb(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

export interface WorkInput {
  type: 'Article' | 'CreativeWork' | 'Person' | 'Place'
  name: string
  description?: string
  url: string
  lang: string
  image?: string
}

// A typed schema.org node for a content page (Article/CreativeWork/Person/Place).
export function creativeWork(input: WorkInput) {
  const { type, name, description, url, lang, image } = input
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    ...(type === 'Article' ? { headline: name } : {}),
    ...(description ? { description } : {}),
    url,
    inLanguage: bcp47(lang),
    isPartOf: IS_PART_OF,
    ...(image ? { image } : {}),
  }
}

interface PageInput {
  type: 'WebPage' | 'AboutPage' | 'CollectionPage' | 'ProfilePage'
  name: string
  description: string
  url: string
  lang: string
}

export function webPage(input: PageInput) {
  return {
    '@context': 'https://schema.org',
    '@type': input.type,
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: bcp47(input.lang),
    isPartOf: { ...IS_PART_OF, url: new URL('/', input.url).toString() },
  }
}

export function webSite(name: string, description: string, url: string, lang: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    description,
    url,
    inLanguage: bcp47(lang),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${new URL('/', url).toString()}search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}
