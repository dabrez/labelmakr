import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Labelmakr',
  description: 'DIY fine-tuning data collection and correction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <header className="border-b border-gray-800 px-6 py-4">
          <a href="/" className="text-xl font-bold tracking-tight text-white hover:text-gray-300">
            labelmakr
          </a>
          <span className="ml-3 text-xs text-gray-500 font-mono">fine-tuning data studio</span>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
