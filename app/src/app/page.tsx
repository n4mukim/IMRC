import Link from 'next/link'

export default function Home() {
  return (
    <main>
      <h1>IMRC blog: setup in progress</h1>
      <p><Link href="/login">Sign in</Link> · <Link href="/dashboard">Dashboard</Link></p>
    </main>
  )
}
