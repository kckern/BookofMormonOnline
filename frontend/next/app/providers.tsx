'use client'

import { ReactNode } from 'react'

// Phase 1: thin client wrapper. Redux and SocketProvider are added in Phase 3
// when community/study routes are migrated.
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>
}
