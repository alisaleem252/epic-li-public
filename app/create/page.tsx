import type { Metadata } from "next"
import Link from "next/link"
import { CreateProfileForm } from "@/components/marketing/create-profile-form"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { sanitizeHandleInput } from "@/lib/handle"
import { REVENUE_SOURCE_OPTIONS } from "@/lib/providers/registry"

export const metadata: Metadata = {
  title: "Create a revenue profile | epic.li",
  description:
    "Create an epic.li public revenue profile from Stripe, Lemon Squeezy, Polar, Dodo Payments, Paddle, RevenueCat, Superwall, App Store Connect, Creem, Whop, or Razorpay.",
}

type CreateProfilePageProps = {
  searchParams: Promise<{ handle?: string | string[] }>
}

export default async function CreateProfilePage({ searchParams }: CreateProfilePageProps) {
  // The homepage claim field links here as /create?handle=... . This only prefills the field.
  const { handle } = await searchParams
  const initialHandle = sanitizeHandleInput(typeof handle === "string" ? handle : "")

  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">
              // Create a public profile
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] sm:text-6xl">
              Prove the numbers. Keep the key private.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#53614e] sm:text-base">
              epic.li makes read-only requests to your selected revenue provider, then creates a public page with aggregate metrics and catalog labels. Add an optional private contact email, plus public website, app, and social links. Your email stays private; no account or password is needed.
            </p>
          </div>
          <section className="border-2 border-[#1c1c16] bg-[#fdf9f0] p-5 shadow-[5px_5px_0px_#1c1c16] sm:p-6" aria-labelledby="supported-sources-title">
            <div className="border-b border-[#1c1c16]/20 pb-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">// Source registry</p>
              <h2 id="supported-sources-title" className="mt-1 text-xl font-bold tracking-[-0.04em]">
                One profile. {REVENUE_SOURCE_OPTIONS.length} sources.
              </h2>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-2" aria-label="Supported revenue sources">
              {REVENUE_SOURCE_OPTIONS.map((source) => (
                <li key={source.id} className="border border-[#1c1c16]/20 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em]">
                  {source.name}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[#1c1c16]/20 pt-4 font-mono text-[10px] leading-relaxed text-[#53614e]">
              Provider keys stay private. Profiles store aggregate snapshots and public catalog names only.
            </p>
          </section>
          <Link
            href="/"
            className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#53614e] underline decoration-[#00b943] decoration-2 underline-offset-4 hover:text-[#1c1c16]"
          >
            Back to epic.li
          </Link>
        </div>
        <CreateProfileForm initialHandle={initialHandle} />
      </main>
      <SiteFooter
        brand="epic.li // profile setup"
        note="Provider credentials are encrypted server-side."
      />
    </div>
  )
}
