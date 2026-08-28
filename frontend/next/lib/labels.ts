import { cache } from 'react'
import { gql } from './graphql'

interface LabelRow { key: string; val: string }

// Localized UI labels for the serving language (gql reads x-lang). Cached per request.
export const getLabels = cache(async (): Promise<Record<string, string>> => {
  const data = await gql<{ labels: LabelRow[] }>(`{ labels { key val } }`, {}, { revalidate: 3600 })
  const map: Record<string, string> = {}
  for (const row of data.labels ?? []) map[row.key] = row.val
  return map
})

export async function label(key: string, fallback: string): Promise<string> {
  return (await getLabels())[key] ?? fallback
}
