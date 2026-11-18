import "server-only"

import { sql } from "drizzle-orm"
import { toMajorUnits } from "@/lib/currency"
import { db } from "@/lib/db"
import { profileChargeEvents } from "@/lib/db/schema"
import { getPublicProfile } from "@/lib/profiles"
import { formatBadgeMoney, type BadgeMetric } from "@/lib/badge-svg"

export type BadgeData = {
  handle: string
  displayName: string
  currency: string
  /** Pre-formatted amounts; a key is missing when the provider doesn't report that figure. */
  amounts: Partial<Record<Exclude<BadgeMetric, "verified">, string>>
  asOf: string
}

const asOfFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** Public-safe numbers for a badge. Only aggregates already shown on the public profile page. */
export async function getBadgeData(rawHandle: string): Promise<BadgeData | null> {
  const data = await getPublicProfile(rawHandle)
  if (!data) return null

  const { profile, provider, snapshot } = data
  const amounts: BadgeData["amounts"] = {}
  const currency = snapshot?.currency ?? "usd"

  if (snapshot && provider.metrics.mrr) amounts.mrr = formatBadgeMoney(toMajorUnits(snapshot.mrrMinor, currency), currency)
  if (snapshot && provider.metrics.revenue) {
    amounts.revenue30 = formatBadgeMoney(toMajorUnits(snapshot.grossChargeAmountMinor, currency), currency)
  }

  // All-time total: summed from stored dated charges in the snapshot's currency (Stripe profiles).
  if (snapshot) {
    const [row] = await db
      .select({ total: sql<string>`coalesce(sum(${profileChargeEvents.amountCapturedMinor}), 0)` })
      .from(profileChargeEvents)
      .where(sql`${profileChargeEvents.profileId} = ${profile.id} and ${profileChargeEvents.currency} = ${currency.toLowerCase()}`)
    const total = BigInt(row?.total ?? "0")
    if (total > BigInt(0)) amounts.total = formatBadgeMoney(toMajorUnits(total, currency), currency)
  }

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    currency,
    amounts,
    asOf: asOfFormatter.format(provider.lastFetchedAt ?? snapshot?.recordedAt ?? new Date()),
  }
}
