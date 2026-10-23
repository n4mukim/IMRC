import { signInWithPassword, signInWithMagicLink } from './actions'

const messages: Record<string, string> = {
  invalid: 'That email and password do not match.',
  send: 'We could not send the link. Try again in a minute.',
  deactivated: 'This account has been deactivated. Contact the IMRC team if you think this is a mistake.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams
  return (
    <main>
      <h1>Sign in</h1>
      {error && <p role="alert">{messages[error] ?? 'Something went wrong.'}</p>}
      {sent && <p role="status">If that address has an account, a sign-in link is on its way.</p>}

      <form action={signInWithPassword}>
        <p><label>Email <input name="email" type="email" autoComplete="email" required /></label></p>
        <p><label>Password <input name="password" type="password" autoComplete="current-password" required /></label></p>
        <button type="submit">Sign in</button>
      </form>

      <h2>Or get a sign-in link</h2>
      <form action={signInWithMagicLink}>
        <p><label>Email <input name="email" type="email" autoComplete="email" required /></label></p>
        <button type="submit">Email me a link</button>
      </form>
    </main>
  )
}
