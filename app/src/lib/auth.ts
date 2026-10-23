import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'pending' | 'author' | 'trusted_author' | 'reviewer' | 'admin'
export type Profile = {
  id: string
  email: string
  display_name: string
  role: Role
  active: boolean
  application_status: 'pending' | 'approved' | 'rejected'
}

/** The signed-in user (verified with Supabase, not just read from a cookie) and their profile row. */
export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, active, application_status')
    .eq('id', user.id)
    .single<Profile>()
  return { user, profile }
}

/** Signed in + e-mail verified + active. Redirects otherwise. The role always comes from the database. */
export async function requireUser() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!s.user.email_confirmed_at) redirect('/verify-email')
  if (!s.profile || !s.profile.active) redirect('/login?error=deactivated')
  return { user: s.user, profile: s.profile }
}

/** Server-side role gate for dashboards and actions. Never trust a role sent from the client. */
export async function requireRole(allowed: Role[]) {
  const s = await requireUser()
  if (!allowed.includes(s.profile.role)) redirect('/dashboard')
  return s
}

export const STAFF: Role[] = ['reviewer', 'admin']
export const WRITERS: Role[] = ['author', 'trusted_author', 'reviewer', 'admin']
