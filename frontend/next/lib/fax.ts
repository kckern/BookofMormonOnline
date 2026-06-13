import { cache } from 'react'
import { gql } from './graphql'

// ── /fax + /fax/:slug data layer ─────────────────────────────────────────────
// Parity target: the legacy PHP box's facsimiles index (57 editions) and detail
// pages. The data is the `fax` GraphQL query, but it is language-scoped: the
// resolver fetches rows in the REQUEST language (en here — the gql endpoint URL
// has no lang segment, so resolveLang() falls back to 'en') and only falls back
// to en when a non-en result is EMPTY. fax(filter:"pdf") therefore returns the
// 52 en editions (com=0, hide=0); five further editions are Korean-only printings
// (lang='ko') that the en query can never surface — same gap lib/sitemap.ts
// documents for KO_ONLY_FAX_SLUGS. The PHP sitemap/index merged across languages
// → 57 total, so we supplement the 5 ko-only rows verbatim (title/info captured
// from the live PHP box) and splice them into the en list at the positions the
// benchmark renders them.

export interface FaxItem {
  slug: string
  title: string
  info: string
}

// The 5 ko-only editions, unreachable through the en gql path. Values mirror the
// live PHP box (/fax index + /fax/{slug} detail) byte-for-byte.
const KO_ONLY_FAX: FaxItem[] = [
  {
    slug: '1962k',
    title: '1962판 불모경의 한 부분 (소책자)',
    info: '1962판 불모경 원서는 제 3니파이의 일부를 수록한 소책자입니다. 홍병식의 번역으로 제작되었으며, 한국에서의 몰몬서를 소개하는 첫 시도였습니다. 이 선택집은 향후 전체 번역에 중요한 기초를 제공하였습니다.',
  },
  {
    slug: '1967k',
    title: '1967판 몰몬경 (말일성도)',
    info: '1967년에는 몰몬경의 한국어 번역본이 처음으로 완전한 형태로 출판되었습니다. 번역은 주로 한인상이 주도하여 완료되었으며, 초기 번역 시도는 1950년대 후반에 시작되었습니다. 번역 과정에는 여러 수정과 검토가 필요했으며, 이는 다양한 번역자와 협력하여 진행되었습니다.',
  },
  {
    slug: '1973kr',
    title: '1973판 몰몬서 (복원교회)',
    info: '1973년에 발행된 몰몬서 한국어 초판은 서울에서 복원예수그리스도교회에 의해 출판되었습니다. 이 판본은 “몰몬서”라는 이름으로 독자들에게 전파되었습니다. 총무사식인침사를 통해 인정되어 광범위한 배포가 가능하게 되었습니다.',
  },
  {
    slug: '2005k',
    title: '2005판 몰몬경 (후기성도)',
    info: '2005년에 출시된 몰몬경 한국어 번역판은 1981년 영어판을 기준으로 새롭게 번역되었습니다. 이 번역은 보다 현대적인 언어와 문법 구조를 채택하여 독자의 이해도를 높였습니다. 번역의 정확성과 일관성을 증가시키기 위해 교회의 글로벌 번역 계획 중 하나로 개발되었습니다.',
  },
  {
    slug: '2020k',
    title: '2020판 몰몬경 특별판',
    info: '이 특별판은 후기성도판 몰몬경에 더 쉽게 익미롭게 다가갈 수 있도록 제작되었습니다. 문단, 인용 부호, 시구문, 내용별 소재목, 위치자 절번호 등과 같은 요소들이 이미 수 십년전부터 현재까지 일반 표준성경에서 활용되고 있다.',
  },
]

// Where each ko-only slug is spliced into the en pdf list to reproduce the
// benchmark's merged ordering: the ko rows are inserted immediately after the
// en row keyed below (the chronological neighbour the PHP box renders before it).
//   1953R → 1962k → 1967k → 1973kr   (the 3 mid-century ko rows, in this order)
//   1999  → 2005k
//   2013  → 2020k
const KO_INSERT_AFTER: Record<string, string[]> = {
  '1953R': ['1962k', '1967k', '1973kr'],
  '1999': ['2005k'],
  '2013': ['2020k'],
}

const FAX_LIST_QUERY = `query FaxList { fax(filter: "pdf") { slug title info } }`

// Build the merged 57-edition list: the 52 en pdf rows in resolver order, with
// the 5 ko-only rows spliced in after their chronological neighbours.
export const getFaxList = cache(async (): Promise<FaxItem[]> => {
  let en: FaxItem[] = []
  try {
    const d = await gql<{ fax: FaxItem[] }>(FAX_LIST_QUERY, {}, { revalidate: 3600 })
    en = d.fax ?? []
  } catch {
    en = []
  }
  const koBySlug = new Map(KO_ONLY_FAX.map((f) => [f.slug, f]))
  const merged: FaxItem[] = []
  for (const row of en) {
    merged.push(row)
    for (const koSlug of KO_INSERT_AFTER[row.slug] ?? []) {
      const ko = koBySlug.get(koSlug)
      if (ko) merged.push(ko)
    }
  }
  return merged
})

// Single edition by slug — resolves both en pdf rows and the 5 ko-only rows.
export const getFax = cache(async (slug: string): Promise<FaxItem | null> => {
  const list = await getFaxList()
  return list.find((f) => f.slug === slug) ?? null
})

// Index-page superscript: the PHP box renders the <img> alt/title of each edition
// with every digit 1–4 as a Unicode superscript (e.g. "1829" → "¹8²9"). Verified
// against all 57 rows. Note this is a DIFFERENT rule than lib/entity.superscript
// (which only superscripts digits that follow a letter) — here ALL low digits in
// the title are raised, including leading ones.
const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³', '4': '⁴' }
export function faxSuperscript(s: string): string {
  return (s ?? '').replace(/[1-4]/g, (d) => SUP[d])
}
