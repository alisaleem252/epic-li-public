import Link from "next/link"
import type { ReactNode } from "react"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"

export const LEGAL_UPDATED = "November 5, 2026"

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#087d32]">// Legal</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-[-0.06em]">{title}</h1>
        <p className="mt-2 font-mono text-[11px] text-[#626257]">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-4 border-2 border-[#1c1c16] bg-[#f7f3ea] p-3 text-xs leading-5 text-[#53614e]">
          epic.li is an open-source project run by an individual. This text describes how the service actually works today.
          It is a plain-language draft, not legal advice, and has not been reviewed by a lawyer.
        </p>
        <div className="mt-8 grid gap-6 text-sm leading-6 [&_h2]:mb-2 [&_h2]:font-mono [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.1em] [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
          {children}
        </div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t-2 border-[#1c1c16] pt-4 font-mono text-[11px] font-bold uppercase">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </main>
      <SiteFooter />
    </div>
  )
}
