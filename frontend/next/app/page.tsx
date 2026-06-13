import { redirect } from 'next/navigation'

// Root redirects to the first chapter.
// Phase 3: read last-visited chapter from cookie and redirect there instead.
export default function RootPage() {
  redirect('/1-nephi/1')
}
