'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (error) redirect('/login?error=invalid')
  redirect('/dashboard')
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: String(formData.get('email') ?? ''),
    // Magic links can only sign in EXISTING accounts. New accounts go through the sign-up form (step 2).
    options: { shouldCreateUser: false, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  })
  // Same message whether or not the address exists, so the form cannot be used to probe for accounts.
  redirect(error && error.status !== 400 ? '/login?error=send' : '/login?sent=1')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
