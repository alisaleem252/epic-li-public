import Link from "next/link"
import type { FeaturedProfileCardData } from "@/lib/featured-profile"

function initialsFor(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
  return initials || "E"
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-[#00e55b]/30 bg-[#161d19] p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#a9b7aa]">{label}</p>
      <p className="mt-1.5 break-words font-mono text-xl font-bold text-[#00e55b] sm:text-2xl">{value}</p>
      <p className="mt-1 font-mono text-[9px] text-[#a9b7aa]">{detail}</p>
    </div>
  )
}

/**
 * The most recently published, verified profile on the homepage. Everything here comes from the database
 * (see `getFeaturedProfileCard`); nothing is hard-coded.
 */
export function FeaturedProfileCard({ data }: { data: FeaturedProfileCardData }) {
  const titleId = "featured-profile-title"

  return (
    <article
      aria-labelledby={titleId}
      className="border-2 border-[#1c1c16] bg-[#101712] text-[#e5f4e7] shadow-[8px_8px_0_#1c1c16]"
    >
      <div className="flex items-center justify-between gap-3 border-b-2 border-[#1c1c16] bg-[#00e55b] px-3 py-1.5 text-[#1c1c16]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">latest_profile.txt</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
          <span aria-hidden="true" className="size-2 border border-[#1c1c16] bg-[#1c1c16]" />
          Latest verified
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center border-2 border-[#00e55b] bg-[#00e55b] text-base font-black text-[#101712]"
          >
            {initialsFor(data.displayName)}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-xl font-black tracking-[-0.05em]">
              {data.displayName}
            </h2>
            <p className="font-mono text-xs text-[#a9b7aa]">@{data.handle}</p>
          </div>
        </div>

        {data.bio ? (
          <blockquote className="mt-4 border-l-2 border-[#00e55b] pl-3 text-sm leading-relaxed text-[#c6d2c7]">
            {data.bio}
          </blockquote>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.mrr ? (
            <Tile
              label="Active subscription MRR"
              value={data.mrr}
              detail={
                data.activeSubscriptions !== null
                  ? `${data.activeSubscriptions.toLocaleString("en-US")} active subscriptions`
                  : "Aggregate figure"
              }
            />
          ) : null}
          {data.revenue ? (
            <Tile label={data.revenueLabel} value={data.revenue} detail={data.reportingPeriod} />
          ) : null}
        </div>

        <p className="mt-4 font-mono text-[10px] leading-relaxed text-[#a9b7aa]">
          Fetched from {data.providerName}
          {data.lastFetched ? ` on ${data.lastFetched}` : ""} with a read-only key. Aggregates only; no customer data.
        </p>

        <Link
          href={`/@${data.handle}`}
          className="mt-4 inline-flex min-h-10 items-center gap-2 border-2 border-[#00e55b] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#00e55b] transition-colors hover:bg-[#00e55b] hover:text-[#101712] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e55b]"
        >
          Open epic.li/@{data.handle} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}
