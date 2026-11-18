import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BadgeStudio } from "@/components/marketing/badge-studio"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { getBadgeData } from "@/lib/badge-data"
import type { BadgeMetric } from "@/lib/badge-svg"
import { normalizeHandle } from "@/lib/profiles"

type BadgesPageProps = { params: Promise<{ handle: string }> }

export const revalidate = 300

export async function generateMetadata({ params }: BadgesPageProps): Promise<Metadata> {
  const handle = normalizeHandle((await params).handle)
  return {
    title: handle ? `Badges for @${handle} | epic.li` : "Badges | epic.li",
    description: handle ? `Embeddable verified-revenue badges and merch artwork for @${handle}.` : undefined,
  }
}

export default async function BadgesPage({ params }: BadgesPageProps) {
  const data = await getBadgeData((await params).handle)
  if (!data) notFound()

  const metrics: BadgeMetric[] = [
    ...(["mrr", "total", "revenue30"] as const).filter((key) => data.amounts[key]),
    "verified",
  ]

  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">// Badges &amp; merch</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] sm:text-6xl">
          Show your proof, everywhere.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-[#53614e] sm:text-base">
          Badges for <span className="font-mono font-bold">@{data.handle}</span> are generated from the public numbers
          on the profile, nothing else. Anyone can click through to verify them.
        </p>
        <Link
          href={`/@${data.handle}`}
          className="mt-4 inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#53614e] underline decoration-[#00b943] decoration-2 underline-offset-4 hover:text-[#1c1c16]"
        >
          Back to @{data.handle}
        </Link>
        <div className="mt-8">
          <BadgeStudio handle={data.handle} metrics={metrics} amounts={data.amounts} asOf={data.asOf} />
        </div>
      </main>
      <SiteFooter brand={`epic.li // @${data.handle} badges`} note="Badges show public aggregates only" />
    </div>
  )
}
