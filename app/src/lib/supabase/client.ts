import { createBrowserClient } from '@supabase/ssr'

/** Browser client. Uses only the public anon key; every table is protected by RLS. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
