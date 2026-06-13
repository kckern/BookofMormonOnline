import type { Metadata } from 'next'
import { DefaultShell } from './_components/DefaultShell'
import { defaultMetadata } from '@/lib/seo'

// Bots get the generic study-resource shell here; humans are proxied to the CRA
// reader by middleware before this ever renders.
export const metadata: Metadata = defaultMetadata('/')

export default function RootPage() {
  return <DefaultShell />
}
