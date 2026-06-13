import type { Metadata } from 'next'
import { HistoryIndex, historyMetadata } from './_index'

export async function generateMetadata(): Promise<Metadata> {
  return historyMetadata('/history')
}

export default async function HistoryPage() {
  return <HistoryIndex />
}
