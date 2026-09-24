import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { superscript } from '@/lib/entity'

export interface ChooserCandidate {
  slug: string
  name: string
  sub?: string | null
}

interface Props {
  /** The bare name the visitor asked for, e.g. 'noah'. */
  requested: string
  candidates: ChooserCandidate[]
  /** Route base the links are built from, e.g. '/people'. */
  base: string
  /** Media path segment for thumbnails. */
  mediaType: 'people' | 'places'
}

// Turn a bare slug into display text: 'angels-to-nephi' → 'Angels To Nephi'.
function humanize(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// A bare name (/people/noah) is ambiguous — the dataset holds noah1, noah2 and
// noah3. Rather than 404 (which is what shared links used to unfurl as), offer
// the variants. noindex so this never competes with the real entity pages;
// follow so the links still pass equity.
export async function chooserMetadata(
  { requested, count, base }: { requested: string; count: number; base: string },
): Promise<Metadata> {
  const slug = requested.trim().toLowerCase()
  const name = humanize(slug)
  return buildMetadata({
    title: name,
    description: `${count} entries in the Book of Mormon share the name ${name}. Choose which one you mean.`,
    // Canonical the normalized spelling, so /people/NOAH does not self-canonical.
    path: `${base}/${slug}`,
    surface: 'collection',
    noindex: true,
    // noindex pages carry no hreflang in this codebase (see the history subtree
    // in test/routes/head-audit.test.ts). buildMetadata gates hreflang on the
    // PATH's seo intent, and an entity path is 'crawl', so the exclusion has to
    // be explicit here — otherwise the chooser advertises alternates to other
    // hosts' choosers, all of them noindex.
    hreflang: false,
  })
}

export function SlugChooser({ requested, candidates, base, mediaType }: Props) {
  const name = humanize(requested)
  return (
    <>
      <h1>{name}</h1>
      <p>
        {candidates.length} entries share this name. Choose which one you mean:
      </p>
      <ul>
        {candidates.map((c) => (
          <li key={c.slug}>
            <a href={`${base}/${c.slug}`}>
              <img
                className="thumb"
                alt={superscript(c.name)}
                title={superscript(c.name)}
                src={`https://media.bookofmormon.online/${mediaType}/${c.slug}`}
              />
              {superscript(c.name)}
            </a>
            {c.sub && <span> — {c.sub}</span>}
          </li>
        ))}
      </ul>
      <p>
        <a href={base}>❮ Back</a>
      </p>
    </>
  )
}
