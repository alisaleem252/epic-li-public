import Link from "next/link"
import { ClaimBackdrop } from "@/components/marketing/claim-backdrop"
import { ClaimHandleForm } from "@/components/marketing/claim-handle-form"
import { FeaturedProfileCard } from "@/components/marketing/featured-profile-card"
import { ScopeManifest } from "@/components/marketing/scope-manifest"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import type { FeaturedProfileCardData } from "@/lib/featured-profile"
import { REVENUE_SOURCE_OPTIONS } from "@/lib/providers/registry"
import { STRIPE_RESTRICTED_KEY_URL } from "@/lib/stripe-permissions"

const REPOSITORY_URL = "https://github.com/alisaleem252/epic-li-public"

const steps = [
  {
    number: "01",
    title: "Pick your handle",
    description:
      "Check that epic.li/@you is free. Nothing is saved or reserved at this stage, and there is no email, password or account.",
  },
  {
    number: "02",
    title: "Connect a read-only key",
    description:
      "Use a restricted Stripe key or a read-only credential from another supported provider. epic.li checks the read endpoints before anything is published.",
  },
  {
    number: "03",
    title: "Share your proof page",
    description:
      "Your public page shows aggregate metrics and product names. Keys and raw provider responses stay encrypted server-side.",
  },
]

const principles = [
  {
    label: "READ-ONLY REQUEST",
    title: "Use least-privilege access",
    text: "Each provider has its own key and permission model. epic.li uses read scopes only and never asks for a full-access Stripe secret key.",
  },
  {
    label: "MINIMAL DATA",
    title: "Aggregate, don’t publish customers",
    text: "Provider responses can include billing or contact details. epic.li encrypts raw responses server-side, publishes only aggregate metrics and catalog labels, and shows raw data only to the credential-verified profile owner.",
  },
  {
    label: "NO ACCOUNT",
    title: "No login or signup",
    text: "A profile is created around a handle and an encrypted provider credential. Credentials are never shown on a public page or returned by the API.",
  },
]

const FEATURED_SOURCE_COUNT = 4

type HomePageProps = {
  /** The latest published, verified profile shown sharp over the illustrative backdrop. Null hides the card. */
  featured: FeaturedProfileCardData | null
}

export function HomePage({ featured }: HomePageProps) {
  const sourceNames = REVENUE_SOURCE_OPTIONS.slice(0, FEATURED_SOURCE_COUNT).map((source) => source.name)
  const moreSources = Math.max(0, REVENUE_SOURCE_OPTIONS.length - FEATURED_SOURCE_COUNT)

  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <SiteHeader />

      <main>
        <section className="relative isolate overflow-hidden border-b-2 border-[#1c1c16]">
          <ClaimBackdrop />

          <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
            <div className={featured ? "grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12" : "mx-auto max-w-2xl"}>
              <div>
                <p className="inline-flex items-center gap-2 border-2 border-[#1c1c16] bg-[#1c1c16] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#00e55b] sm:text-[10px]">
                  Open source · read-only keys · no screenshots
                </p>
                <h1 className="mt-5 text-4xl font-bold uppercase leading-[0.9] tracking-[-0.08em] sm:text-6xl">
                  Claim your handle.
                  <span className="mt-3 block w-fit max-w-full border-2 border-[#1c1c16] bg-[#00e55b] px-2 py-1 shadow-[5px_5px_0px_#1c1c16]">
                    Prove your revenue.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-[#3d4a3a] sm:text-lg">
                  Connect a read-only key from your payment provider and get a public profile built from your
                  provider’s own data, not a screenshot you can edit.
                </p>

                <div className="mt-8 max-w-xl">
                  <ClaimHandleForm />
                  <p className="mt-4 font-mono text-[10px] leading-relaxed text-[#53614e]">
                    Works with {sourceNames.join(", ")}
                    {moreSources > 0 ? ` and ${moreSources} more.` : "."}
                  </p>
                </div>
              </div>

              {featured ? <FeaturedProfileCard data={featured} /> : null}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b-2 border-[#1c1c16] bg-[#f7f3ea] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#087d32]">// How it works</p>
            <h2 className="mt-2 text-3xl font-bold uppercase leading-none tracking-[-0.07em] sm:text-5xl">
              Three steps. No theater.
            </h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="border-2 border-[#1c1c16] bg-white p-5 shadow-[4px_4px_0px_#1c1c16] sm:p-6"
                >
                  <span className="font-mono text-3xl font-bold tracking-[-0.08em] text-[#087d32]">{step.number}</span>
                  <h3 className="mt-5 text-xl font-bold uppercase tracking-[-0.04em]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#53614e]">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="permissions" className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#087d32]">
                // Why you can trust it
              </p>
              <h2 className="mt-2 max-w-xl text-3xl font-bold uppercase leading-[0.95] tracking-[-0.07em] sm:text-5xl">
                Don’t trust us. Read the code.
              </h2>
              <div className="mt-7 grid gap-4">
                {principles.map((principle) => (
                  <article key={principle.label} className="border-l-4 border-[#00b943] pl-4">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#087d32]">
                      {principle.label}
                    </p>
                    <h3 className="mt-1 font-bold tracking-[-0.03em]">{principle.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#53614e]">{principle.text}</p>
                  </article>
                ))}
              </div>
              <a
                href={REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex min-h-11 items-center gap-2 border-2 border-[#1c1c16] bg-white px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Audit how keys are handled on GitHub <span aria-hidden="true">↗</span>
              </a>
            </div>

            <div>
              <ScopeManifest />
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={STRIPE_RESTRICTED_KEY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border-2 border-[#1c1c16] bg-[#1c1c16] px-4 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-white shadow-[4px_4px_0px_#00e55b] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#00e55b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] sm:text-[10px]"
                >
                  Create restricted key in Stripe <span aria-hidden="true">↗</span>
                </a>
                <Link
                  href="/demo"
                  className="inline-flex min-h-11 items-center gap-2 border-2 border-[#1c1c16] bg-white px-4 font-mono text-[9px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0px_#1c1c16] hover:bg-[#f2ede4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] sm:text-[10px]"
                >
                  Inspect sample profile <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
