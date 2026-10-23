// Supabase Edge Function (Deno): ends a deactivated user's access at the Auth level.
//
// The database already refuses everything a deactivated user tries (my_role() returns null for inactive accounts).
// This function also bans the Auth account so they cannot sign in again and their refresh token stops working.
// Call it from the Users screen right after public.set_user_active(). Deploy WITH JWT verification (the default).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const { user_id, banned } = await req.json().catch(() => ({}))
  if (typeof user_id !== 'string' || typeof banned !== 'boolean') return json({ error: 'bad_request' }, 400)

  // 1. Who is calling? Use THEIR token, so the database decides whether they are staff.
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: me } = await asCaller.auth.getUser()
  const { data: isStaff } = await asCaller.rpc('is_staff')
  if (!me?.user || isStaff !== true) return json({ error: 'forbidden' }, 403)
  if (me.user.id === user_id) return json({ error: 'forbidden: you cannot ban yourself' }, 403)

  // 2. Only apply a ban that matches what the database already decided (set_user_active must have run first).
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: target } = await admin.from('profiles').select('active, role').eq('id', user_id).single()
  if (!target) return json({ error: 'not_found' }, 404)
  if (banned === target.active) return json({ error: 'state_mismatch: deactivate the account first' }, 409)

  const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: banned ? '876000h' : 'none' })
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
