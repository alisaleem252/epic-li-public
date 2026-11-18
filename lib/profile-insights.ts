import { toMajorUnits } from "@/lib/currency"
import type { ChargeTrajectoryEvent } from "@/lib/charge-trajectories"

/**
 * Pure derivations from the dated charge facts already stored per profile
 * (profile_charge_events). No customer identifiers: customers are one-way hashes.
 * Everything is bucketed by UTC calendar month.
 */

const MAX_MONTHS = 36

export type InsightMonth = {
  label: string
  revenue: number
  recurring: number
  oneTime: number
  cumulative: number
  /** Month-over-month change in revenue, in percent. Null when the previous month had no revenue. */
  growthPct: number | null
  charges: number
}

export type ProfileInsights = {
  currency: string
  months: InsightMonth[]
  totalRevenue: number
  chargeCount: number
  averageCharge: number | null
  bestMonth: { label: string; revenue: number } | null
  payingCustomers: number
  /** Share of identified customers who paid more than once, in percent. */
  repeatCustomerPct: number | null
  /** Share of all-time revenue from recurring charges, in percent. */
  recurringSharePct: number | null
  latestGrowthPct: number | null
  hasData: boolean
}

const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })

function monthKey(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

export function buildProfileInsights(
  events: ChargeTrajectoryEvent[],
  currency: string,
  now: Date = new Date(),
): ProfileInsights {
  const code = currency.toLowerCase()
  const scoped = events.filter((event) => event.currency.toLowerCase() === code)

  if (scoped.length === 0) {
    return {
      currency: code,
      months: [],
      totalRevenue: 0,
      chargeCount: 0,
      averageCharge: null,
      bestMonth: null,
      payingCustomers: 0,
      repeatCustomerPct: null,
      recurringSharePct: null,
      latestGrowthPct: null,
      hasData: false,
    }
  }

  const first = scoped.reduce((min, event) => (event.occurredAt < min ? event.occurredAt : min), scoped[0].occurredAt)
  const endKey = monthKey(now)
  const startKey = Math.max(monthKey(first), endKey - (MAX_MONTHS - 1))

  const buckets = new Map<number, { revenue: number; recurring: number; oneTime: number; charges: number }>()
  const chargesPerCustomer = new Map<string, number>()
  let totalRevenue = 0
  let recurringTotal = 0

  for (const event of scoped) {
    const amount = toMajorUnits(event.amountCapturedMinor, code)
    totalRevenue += amount
    if (event.isRecurring) recurringTotal += amount
    if (event.customerHash) {
      chargesPerCustomer.set(event.customerHash, (chargesPerCustomer.get(event.customerHash) ?? 0) + 1)
    }

    const key = monthKey(event.occurredAt)
    if (key < startKey || key > endKey) continue
    const bucket = buckets.get(key) ?? { revenue: 0, recurring: 0, oneTime: 0, charges: 0 }
    bucket.revenue += amount
    if (event.isRecurring) bucket.recurring += amount
    else bucket.oneTime += amount
    bucket.charges += 1
    buckets.set(key, bucket)
  }

  // Revenue before the visible window still counts toward the running total.
  let cumulative = scoped.reduce((sum, event) => {
    return monthKey(event.occurredAt) < startKey ? sum + toMajorUnits(event.amountCapturedMinor, code) : sum
  }, 0)

  const months: InsightMonth[] = []
  let previousRevenue: number | null = null
  for (let key = startKey; key <= endKey; key += 1) {
    const bucket = buckets.get(key) ?? { revenue: 0, recurring: 0, oneTime: 0, charges: 0 }
    cumulative += bucket.revenue
    months.push({
      label: monthLabel.format(new Date(Date.UTC(Math.floor(key / 12), key % 12, 1))),
      revenue: round2(bucket.revenue),
      recurring: round2(bucket.recurring),
      oneTime: round2(bucket.oneTime),
      cumulative: round2(cumulative),
      growthPct: previousRevenue && previousRevenue > 0 ? round1(((bucket.revenue - previousRevenue) / previousRevenue) * 100) : null,
      charges: bucket.charges,
    })
    previousRevenue = bucket.revenue
  }

  const best = months.reduce<InsightMonth | null>((top, month) => (!top || month.revenue > top.revenue ? month : top), null)
  const customers = chargesPerCustomer.size
  const repeaters = [...chargesPerCustomer.values()].filter((count) => count > 1).length

  // "Latest growth" compares the last two COMPLETE months so a partial current month doesn't read as a crash.
  const complete = months.slice(0, -1)
  const latestComplete = complete.at(-1)

  return {
    currency: code,
    months,
    totalRevenue: round2(totalRevenue),
    chargeCount: scoped.length,
    averageCharge: round2(totalRevenue / scoped.length),
    bestMonth: best && best.revenue > 0 ? { label: best.label, revenue: best.revenue } : null,
    payingCustomers: customers,
    repeatCustomerPct: customers > 0 ? round1((repeaters / customers) * 100) : null,
    recurringSharePct: totalRevenue > 0 ? round1((recurringTotal / totalRevenue) * 100) : null,
    latestGrowthPct: latestComplete?.growthPct ?? null,
    hasData: true,
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}
