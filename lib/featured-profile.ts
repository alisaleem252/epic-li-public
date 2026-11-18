import "server-only"

import { formatMinorCurrency } from "@/lib/currency"

export type FeaturedProfileCardData = {
  handle: string
  displayName: string
  bio: string
  providerName: string
  mrr: string | null
  revenueLabel: string
  revenue: string | null
  reportingPeriod: string
  activeSubscriptions: number | null
  lastFetched: string | null
}

function formatUtcDay(value: string | Date, options: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date)
}

/**
 * Loads the most recently published verified profile for the homepage. Never throws: if the database is
 * not configured (for example a fresh local checkout), the profile does not
 * exist yet, or it has no snapshot, the homepage simply renders without the card.
 *
 * `@/lib/profiles` is imported lazily on purpose. `@/lib/db` throws at import time
 * when `DATABASE_URL` is missing, which a static import would turn into a crashed page.
 */
export async function getFeaturedProfileCard(): Promise<FeaturedProfileCardData | null> {
  try {
    const { getLatestPublishedHandles, getPublicProfile } = await import("@/lib/profiles")
    // Newest published profile that already has a verified snapshot.
    let data: Awaited<ReturnType<typeof getPublicProfile>> = null
    for (const handle of await getLatestPublishedHandles()) {
      const candidate = await getPublicProfile(handle)
      if (candidate?.snapshot) {
        data = candidate
        break
      }
    }
    if (!data?.snapshot) return null

    const { profile, provider, snapshot } = data

    return {
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      providerName: provider.name,
      mrr: provider.metrics.mrr ? formatMinorCurrency(snapshot.mrrMinor, snapshot.currency) : null,
      revenueLabel: provider.metrics.revenueLabel,
      revenue: provider.metrics.revenue
        ? formatMinorCurrency(snapshot.grossChargeAmountMinor, snapshot.currency)
        : null,
      reportingPeriod: `${formatUtcDay(snapshot.periodStart, { month: "short", day: "numeric" })}–${formatUtcDay(snapshot.periodEnd, { month: "short", day: "numeric" })}`,
      activeSubscriptions: provider.metrics.activeSubscriptions ? snapshot.activeSubscriptionCount : null,
      lastFetched: provider.lastFetchedAt
        ? formatUtcDay(provider.lastFetchedAt, { month: "short", day: "numeric", year: "numeric" })
        : null,
    }
  } catch (error) {
    console.error("Featured homepage profile is unavailable", error)
    return null
  }
}
