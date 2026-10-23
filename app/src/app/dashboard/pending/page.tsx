import { requireUser } from '@/lib/auth'

export default async function Pending() {
  const { profile } = await requireUser()
  return (
    <main>
      <h1>Your application</h1>
      {profile.application_status === 'rejected'
        ? <p>Your application was not approved. You can still edit your profile, but you cannot post.</p>
        : <p>Thanks for signing up. A reviewer will look at your application soon. You can edit your profile while you wait, but you cannot post yet.</p>}
    </main>
  )
}
