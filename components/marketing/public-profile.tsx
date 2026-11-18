import Link from "next/link"
import type { ProfileAudience } from "@/lib/audience"
import type { ChargeTrajectories } from "@/lib/charge-trajectories"
import type { ProfileInsights } from "@/lib/profile-insights"
import { InsightsCharts } from "./insights-charts"
import { formatMinorCurrency } from "@/lib/currency"
import type { PublicProfileData } from "@/lib/profiles"
import { PROFILE_SOCIAL_PLATFORMS } from "@/lib/profile-links"
import { TrajectoryChart } from "./trajectory-chart"
import { SiteFooter } from "./site-footer"
import { SiteHeader } from "./site-header"

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="flex min-h-32 flex-col justify-between border-2 border-[#1c1c16] bg-white p-4 shadow-[4px_4px_0_#1c1c16] sm:p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#626257]">{label}</p>
      <div>
        <p className="text-3xl font-black tracking-[-0.06em] sm:text-4xl">{value}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#626257]">{detail}</p>
      </div>
    </article>
  )
}

function safeWebsiteHref(value: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

function reportingPeriod(periodStart: string, periodEnd: string) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`))

  return `${format(periodStart)}–${format(periodEnd)}`
}

function safeSocialHref(value: string | undefined, allowedHosts: readonly string[]) {
  const href = safeWebsiteHref(value ?? null)
  if (!href) return null

  const url = new URL(href)
  const hostname = url.hostname.toLowerCase()
  const allowedHost = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  )
  return url.protocol === "https:" && allowedHost ? url.toString() : null
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(value)
}

function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border border-[#53614e] p-3">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#a9b7aa]">{label}</p>
      <p className="mt-1 text-xl font-black tracking-[-0.04em] text-[#e5f0e4] sm:text-2xl">{value}</p>
      {detail ? <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-[#a9b7aa]">{detail}</p> : null}
    </div>
  )
}

function ProofCard({
  handle,
  providerName,
  lastFetchedAt,
  mrr,
  revenue,
  reach,
  customers,
}: {
  handle: string
  providerName: string
  lastFetchedAt: Date | null
  mrr: string | null
  revenue: { label: string; value: string } | null
  reach: string | null
  customers: string | null
}) {
  const stats = [
    mrr ? { label: "MRR", value: mrr } : null,
    revenue,
    reach ? { label: "Reach", value: reach } : null,
    customers ? { label: "Paying customers", value: customers } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null)
  const badgeMetric = mrr ? "mrr" : "verified"

  return (
    <aside
      aria-label="Verification summary"
      className="border-2 border-[#1c1c16] bg-[#101410] p-4 text-[#e5f0e4] shadow-[5px_5px_0_#00e55b] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#53614e] pb-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#00e55b]">
          <span aria-hidden="true">✓ </span>Verified via {providerName}
        </p>
        {lastFetchedAt ? (
          <time
            dateTime={lastFetchedAt.toISOString()}
            className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#a9b7aa]"
          >
            Fetched {lastFetchedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
          </time>
        ) : null}
      </div>

      {stats.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {stats.slice(0, 4).map((stat) => (
            <div key={stat.label}>
              <dt className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#a9b7aa]">{stat.label}</dt>
              <dd className="mt-0.5 text-xl font-black tracking-[-0.04em] sm:text-2xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-4 border-t border-[#53614e] pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- live SVG badge endpoint */}
        <img
          src={`/badge/${encodeURIComponent(handle)}?metric=${badgeMetric}&theme=light`}
          alt={`epic.li verified badge for @${handle}`}
          height={37}
          className="h-[37px] w-auto max-w-full"
        />
        <Link
          href={`/@${handle}/badges`}
          className="mt-3 inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#00e55b] underline decoration-2 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e55b]"
        >
          Embed it, export it, print it →
        </Link>
      </div>
    </aside>
  )
}

export function PublicProfile({
  data,
  trajectories,
  insights,
  audience,
}: {
  data: PublicProfileData
  trajectories: ChargeTrajectories
  insights: ProfileInsights
  audience: ProfileAudience
}) {
  const { profile, provider, snapshot } = data
  const websiteHref = safeWebsiteHref(profile.websiteUrl)
  const appHref = safeWebsiteHref(profile.appUrl)
  const socialLinks = PROFILE_SOCIAL_PLATFORMS.flatMap((platform) => {
    const href = safeSocialHref(profile.socialLinks[platform.key], platform.allowedHosts)
    return href ? [{ key: platform.key, label: platform.label, href }] : []
  })
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <div className="border-b-2 border-[#1c1c16] bg-[#00e55b] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] sm:text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <span>PUBLIC {provider.name.toUpperCase()} PROFILE</span>
          <span className="text-right">Latest aggregate snapshot · {snapshot ? snapshot.currency.toUpperCase() : "Awaiting first sync"}</span>
        </div>
      </div>

      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <section className="border-b-2 border-[#1c1c16] pb-8 sm:pb-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div>
            <div className="flex items-start gap-4 sm:gap-6">
              <div
                aria-hidden="true"
                className="grid size-16 shrink-0 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] text-xl font-black shadow-[4px_4px_0_#1c1c16] sm:size-20 sm:text-2xl"
              >
                {initials || "E"}
              </div>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#626257]">Public profile · {provider.name} connected</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-0.07em] sm:text-6xl">{profile.displayName}</h1>
                <p className="mt-2 font-mono text-sm text-[#626257]">@{profile.handle}</p>
                {profile.bio ? <p className="mt-4 max-w-2xl text-base leading-7 text-[#3d3d35]">{profile.bio}</p> : null}
                {socialLinks.length > 0 ? (
                  <nav aria-label="Social profiles" className="mt-4 flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <a
                        key={link.key}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center border border-[#1c1c16]/30 bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#3d3d35] hover:border-[#087d32] hover:text-[#087d32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c16]"
                      >
                        {link.label} <span aria-hidden="true" className="ml-2">↗</span>
                      </a>
                    ))}
                  </nav>
                ) : null}
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {websiteHref ? (
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center border-2 border-[#1c1c16] bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
                >
                  Website <span aria-hidden="true" className="ml-2 text-base">↗</span>
                </a>
              ) : null}
              {appHref ? (
                <a
                  href={appHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center border-2 border-[#1c1c16] bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
                >
                  Open app <span aria-hidden="true" className="ml-2 text-base">↗</span>
                </a>
              ) : null}
              <Link
                href={`/@${profile.handle}/badges`}
                className="inline-flex min-h-10 items-center justify-center border-2 border-[#1c1c16] bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Badges &amp; merch
              </Link>
              <Link
                href={`/edit/${profile.handle}`}
                className="inline-flex min-h-10 items-center justify-center border-2 border-[#1c1c16] bg-[#00e55b] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Edit profile
              </Link>
            </div>
            </div>
            <ProofCard
              handle={profile.handle}
              providerName={provider.name}
              lastFetchedAt={provider.lastFetchedAt}
              mrr={snapshot && provider.metrics.mrr ? formatMinorCurrency(snapshot.mrrMinor, snapshot.currency) : null}
              revenue={
                insights.hasData
                  ? { label: "Total revenue", value: formatMoney(insights.totalRevenue, insights.currency) }
                  : snapshot && provider.metrics.revenue
                    ? { label: provider.metrics.revenueLabel, value: formatMinorCurrency(snapshot.grossChargeAmountMinor, snapshot.currency) }
                    : null
              }
              reach={audience.totalFollowers > 0 ? formatCompact(audience.totalFollowers) : null}
              customers={insights.hasData ? insights.payingCustomers.toLocaleString("en-US") : null}
            />
          </div>
        </section>

        <section aria-label={`${provider.name} revenue summary`} className="grid gap-4 py-7 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Active subscription MRR"
            value={snapshot && provider.metrics.mrr ? formatMinorCurrency(snapshot.mrrMinor, snapshot.currency) : "—"}
            detail={
              !provider.metrics.mrr
                ? "Not reported by this provider"
                : snapshot
                  ? `${snapshot.currency.toUpperCase()} · ${formatMinorCurrency(snapshot.mrrMinor * BigInt(12), snapshot.currency)} annualized run rate`
                  : "First sync pending"
            }
          />
          <Metric
            label={provider.metrics.revenueLabel}
            value={snapshot && provider.metrics.revenue ? formatMinorCurrency(snapshot.grossChargeAmountMinor, snapshot.currency) : "—"}
            detail={
              !provider.metrics.revenue
                ? "Not reported by this provider"
                : snapshot
                  ? provider.metrics.chargeCount
                    ? `${snapshot.successfulChargeCount.toLocaleString("en-US")} successful charges · ${reportingPeriod(snapshot.periodStart, snapshot.periodEnd)}`
                    : `Reported ${reportingPeriod(snapshot.periodStart, snapshot.periodEnd)}`
                  : "No public metrics yet"
            }
          />
          <Metric
            label="Active products"
            value={data.catalogCounts.products.toLocaleString("en-US")}
            detail={`${data.catalogCounts.plans.toLocaleString("en-US")} active plans`}
          />
          <Metric
            label="Active subscriptions"
            value={snapshot && provider.metrics.activeSubscriptions ? snapshot.activeSubscriptionCount.toLocaleString("en-US") : "—"}
            detail={!provider.metrics.activeSubscriptions ? "Not reported by this provider" : snapshot ? "Aggregate count" : "No public metrics yet"}
          />
        </section>


        {audience.entries.length > 0 ? (
          <section aria-label="Audience and reach" className="mb-7 border-2 border-[#1c1c16] bg-white p-5 shadow-[5px_5px_0_#1c1c16] sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[#1c1c16] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#626257]">Audience</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">Reach vs revenue</h2>
              </div>
              <p className="max-w-sm text-right font-mono text-[9px] uppercase leading-4 tracking-[0.08em] text-[#626257]">
                Followers marked verified are read from the platform&apos;s public API. The rest are reported by the owner.
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Metric
                label="Cumulative reach"
                value={formatCompact(audience.totalFollowers)}
                detail={`${audience.totalFollowers.toLocaleString("en-US")} followers · ${audience.entries.length} platforms`}
              />
              <Metric
                label="Cumulative revenue"
                value={insights.hasData ? formatMoney(insights.totalRevenue, insights.currency) : "—"}
                detail={insights.hasData ? `${insights.currency.toUpperCase()} · from stored dated charges` : "No dated charge history"}
              />
              <Metric
                label="Revenue per 1K followers"
                value={
                  insights.hasData && audience.totalFollowers > 0
                    ? formatMoney(insights.totalRevenue / (audience.totalFollowers / 1000), insights.currency)
                    : "—"
                }
                detail="Cumulative revenue ÷ cumulative reach"
              />
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {audience.entries.map((entry) => (
                <li key={entry.platform} className="flex items-center justify-between gap-3 border border-[#1c1c16]/25 px-3 py-2">
                  <span>
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.1em]">{entry.label}</span>
                    <span className="block text-lg font-black tracking-[-0.04em]">{entry.followers.toLocaleString("en-US")}</span>
                  </span>
                  <span
                    className={
                      "border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] " +
                      (entry.source === "verified"
                        ? "border-[#087d32] bg-[#e7f6e7] text-[#087d32]"
                        : "border-[#1c1c16]/40 text-[#626257]")
                    }
                  >
                    {entry.source === "verified" ? "✓ Verified" : "Self-reported"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="border-2 border-[#1c1c16] bg-[#101410] p-5 text-[#e5f0e4] shadow-[5px_5px_0_#1c1c16] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#53614e] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#00e55b]">Revenue trajectory</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">Charges over time</h2>
              </div>
              <time
                dateTime={provider.lastFetchedAt?.toISOString()}
                className="border border-[#53614e] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#a9b7aa]"
              >
                {provider.lastFetchedAt
                  ? `Last fetched ${provider.lastFetchedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
                  : "Fetch date unavailable"}
              </time>
            </div>
            {provider.id === "stripe" ? (
              <div className="pt-5">
                <TrajectoryChart trajectories={trajectories} />
              </div>
            ) : (
              <div className="grid min-h-52 place-items-center py-8 text-center">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#00e55b]">
                    Charge history not available
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[#a9b7aa]">
                    {provider.name} does not provide dated charge history for this profile.
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3 border-t border-[#53614e] pt-4 font-mono text-[10px] leading-5 text-[#a9b7aa]">
              Revenue and MRR are summed from dated captured charges. Churn compares distinct paying customers
              between adjacent periods using one-way customer hashes. Raw {provider.name} charge and subscription
              records are not part of the public profile data model.
            </div>
          </section>

          <section className="border-2 border-[#1c1c16] bg-white p-5 shadow-[5px_5px_0_#1c1c16] sm:p-7">
            <div className="flex items-end justify-between gap-3 border-b-2 border-[#1c1c16] pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#626257]">{provider.name} catalog</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">Products &amp; plans</h2>
              </div>
              <span className="font-mono text-xs font-bold">
                {data.catalogCounts.products + data.catalogCounts.plans} ACTIVE ITEMS
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-6">
              <div>
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#626257]">Products</h3>
                {data.products.length ? (
                  <ul className="mt-3 flex flex-col divide-y divide-[#d9d3c9]">
                    {data.products.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-4 py-3">
                        <span className="font-semibold">{product.name}</span>
                        <span className="font-mono text-[10px] uppercase text-[#626257]">Active</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#626257]">No active products to display.</p>
                )}
                {data.catalogCounts.products > data.products.length ? (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#626257]">
                    Showing {data.products.length} of {data.catalogCounts.products} active products.
                  </p>
                ) : null}
              </div>

              <div>
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#626257]">Plans</h3>
                {data.plans.length ? (
                  <ul className="mt-3 flex flex-col divide-y divide-[#d9d3c9]">
                    {data.plans.map((plan) => (
                      <li key={plan.id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase text-[#626257]">
                            {plan.billingInterval
                              ? `Every ${plan.intervalCount} ${plan.billingInterval}${plan.intervalCount > 1 ? "s" : ""}`
                              : "Provider catalog plan"}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold">
                          {plan.amountMinor !== null && plan.currency
                            ? formatMinorCurrency(plan.amountMinor, plan.currency)
                            : "Price not reported"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#626257]">No active plans to display.</p>
                )}
                {data.catalogCounts.plans > data.plans.length ? (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#626257]">
                    Showing {data.plans.length} of {data.catalogCounts.plans} active plans.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>


        {provider.id === "stripe" && insights.hasData ? (
          <section
            aria-label="Revenue insights"
            className="mt-6 border-2 border-[#1c1c16] bg-[#101410] p-5 text-[#e5f0e4] shadow-[5px_5px_0_#1c1c16] sm:p-7"
          >
            <div className="border-b border-[#53614e] pb-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#00e55b]">Insights</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.05em]">Trends behind the number</h2>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi
                label="Best month"
                value={insights.bestMonth ? formatMoney(insights.bestMonth.revenue, insights.currency) : "—"}
                detail={insights.bestMonth?.label}
              />
              <Kpi
                label="Average charge"
                value={insights.averageCharge !== null ? formatMoney(insights.averageCharge, insights.currency) : "—"}
                detail={`${insights.chargeCount.toLocaleString("en-US")} charges`}
              />
              <Kpi label="Paying customers" value={insights.payingCustomers.toLocaleString("en-US")} detail="Distinct, hashed" />
              <Kpi
                label="Repeat customers"
                value={insights.repeatCustomerPct !== null ? `${insights.repeatCustomerPct}%` : "—"}
                detail="Paid more than once"
              />
              <Kpi
                label="Recurring share"
                value={insights.recurringSharePct !== null ? `${insights.recurringSharePct}%` : "—"}
                detail="Of all revenue"
              />
              <Kpi
                label="Last full month"
                value={
                  insights.latestGrowthPct !== null
                    ? `${insights.latestGrowthPct > 0 ? "+" : ""}${insights.latestGrowthPct}%`
                    : "—"
                }
                detail="Revenue vs month before"
              />
            </div>
            <div className="mt-5">
              <InsightsCharts insights={insights} />
            </div>
            {trajectories.truncated ? (
              <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.08em] text-[#a9b7aa]">
                Based on the newest {trajectories.eventCount.toLocaleString("en-US")} stored charges.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-7 flex flex-col justify-between gap-4 border-2 border-[#1c1c16] bg-[#f2ede4] p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#626257]">Data boundary</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#3d3d35]">
              This page shows aggregate {provider.name} metrics and public catalog labels, never customer identities or raw transactions. Provider credentials and raw provider responses are encrypted server-side and are never included in public profile data.
              {provider.id === "stripe" ? " The owner also confirmed the requested permissions in Stripe Dashboard; endpoint probes cannot independently verify the complete grants." : " The provider remains the source of truth for the connected credential's permissions."}
            </p>
          </div>
          <Link
            href="/demo"
            className="inline-flex min-h-11 shrink-0 items-center justify-center border-2 border-[#1c1c16] bg-[#00e55b] px-4 font-mono text-xs font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_#1c1c16] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
          >
            View demo profile <span aria-hidden="true" className="ml-2 text-base">→</span>
          </Link>
        </section>
      </main>
      <SiteFooter
        brand={`epic.li // @${profile.handle}`}
        note="Aggregate metrics only · credentials stay private"
      />
    </div>
  )
}
