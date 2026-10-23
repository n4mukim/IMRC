import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export default async function Dashboard() {
  const { profile } = await requireUser()
  if (profile.role === 'pending') redirect('/dashboard/pending')
  return <main><h1>My posts</h1><p>The editor arrives in step 3.</p></main>
}
