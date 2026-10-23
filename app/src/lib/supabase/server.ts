import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Supabase client for Server Components, Server Actions and Route Handlers. Uses the signed-in user's session + RLS. */
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // called from a Server Component: the proxy refreshes the session instead
        }
      },
    },
  })
}
