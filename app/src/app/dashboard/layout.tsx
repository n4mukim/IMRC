import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireUser, STAFF } from '@/lib/auth'
import { signOut } from '@/app/login/actions'

// Server-side gate for EVERYTHING under /dashboard: signed in, e-mail verified, account active.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireUser()
  return (
    <>
      <nav>
        <Link href="/dashboard">My posts</Link>
        {STAFF.includes(profile.role) && <> · <Link href="/dashboard/review">Review</Link></>}
        {' · '}{profile.display_name} ({profile.role})
        <form action={signOut} style={{ display: 'inline', marginLeft: 8 }}><button type="submit">Sign out</button></form>
      </nav>
      <hr />
      {children}
    </>
  )
}
