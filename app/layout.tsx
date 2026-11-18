import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'epic.li — Proof, not screenshots',
  description: 'Create a public revenue profile from Stripe, payment processors, and app-store subscription providers. Credentials stay private; public pages show aggregate metrics and catalog items.',
  generator: 'epic.li',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fdf9f0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="light">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
