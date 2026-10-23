// Supabase Edge Function (Deno). Sends the rows waiting in public.notifications through Resend.
//
// Trigger it with ANY of:
//   - a Database Webhook on INSERT into public.notifications (instant), or
//   - a cron schedule every minute (pg_cron + pg_net, or Supabase Cron).
// Both must send the header  x-webhook-secret: <WEBHOOK_SECRET>.
//
// Secrets (supabase secrets set ...): RESEND_API_KEY, EMAIL_FROM, SITE_URL, WEBHOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { render, type Template } from '../_shared/templates.ts'

const MAX_ATTEMPTS = 5

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: rows, error } = await db
    .from('notifications').select('*').is('sent_at', null).lt('attempts', MAX_ATTEMPTS)
    .order('created_at').limit(50)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const n of rows ?? []) {
    try {
      const mail = render(n.template as Template, n.payload ?? {}, Deno.env.get('SITE_URL')!)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), to: n.to_email, subject: mail.subject, text: mail.text, html: mail.html }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      await db.from('notifications').update({ sent_at: new Date().toISOString(), attempts: n.attempts + 1, last_error: null }).eq('id', n.id)
      sent++
    } catch (e) {
      await db.from('notifications').update({ attempts: n.attempts + 1, last_error: String(e).slice(0, 300) }).eq('id', n.id)
    }
  }
  return Response.json({ sent, tried: rows?.length ?? 0 })
})
