import type { ReactNode } from 'react'
import { requireRole, STAFF } from '@/lib/auth'

// Only reviewers and admins. Re-checked on the server on every request.
export default async function ReviewLayout({ children }: { children: ReactNode }) {
  await requireRole(STAFF)
  return <>{children}</>
}
