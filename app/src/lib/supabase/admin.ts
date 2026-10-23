import { createClient } from '@supabase/supabase-js'

/**
 * SERVICE-ROLE client: bypasses RLS. Server only.
 * Use it for things a user must not be able to do themselves (ban a deactivated user, send email, bootstrap).
 */
if (typeof window !== 'undefined') {
  throw new Error('supabase/admin must never be imported in client code')
}

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
