import type { ReactNode } from 'react'

export const metadata = { title: 'IMRC', description: 'Intercultural Mental Health & Resilience Research Centre' }

// Step 1 is plumbing only. The IMRC visual system is ported in a later step.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem', lineHeight: 1.6 }}>{children}</body>
    </html>
  )
}
