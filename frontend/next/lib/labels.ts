import { cache } from 'react'
import { headers } from 'next/headers'
import { gql } from './graphql'

interface LabelRow { key: string; val: string }

// Localized UI labels for the serving language (gql reads x-lang). Cached per request.
export const getLabels = cache(async (): Promise<Record<string, string>> => {
  const data = await gql<{ labels: LabelRow[] }>(`{ labels { key val } }`, {}, { revalidate: 3600 })
  const map: Record<string, string> = {}
  for (const row of data.labels ?? []) map[row.key] = row.val
  return map
})

// English uses the fallback (the English source string) with no fetch — keeps English
// pages free of the labels dependency. Non-English degrades to the fallback on a labels
// outage rather than 500 the page.
export async function label(key: string, fallback: string): Promise<string> {
  const lang = (await headers()).get('x-lang') ?? 'en'
  if (lang === 'en') return fallback
  try {
    return (await getLabels())[key] ?? fallback
  } catch {
    return fallback
  }
}
