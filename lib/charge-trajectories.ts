import { toMajorUnits } from "@/lib/currency"

export const MAX_STORED_CHARGES = 5_000

export type TrajectoryMetric = "revenue" | "mrr" | "churn"
export type TrajectoryRange = "24h" | "7d" | "30d" | "3m" | "6m" | "12m" | "all"

export type ChargeTrajectoryEvent = {
  occurredAt: Date
  currency: string
  amountCapturedMinor: bigint
  isRecurring: boolean
  customerHash: string | null
}

export type TrajectoryPoint = {
  label: string
  value: number | null
}

export type TrajectorySeries = Record<
  TrajectoryRange,
  Record<TrajectoryMetric, TrajectoryPoint[]>
>

export type ChargeTrajectories = {
  currency: string
  series: TrajectorySeries
  eventCount: number
  truncated: boolean
}

export const TRAJECTORY_METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "mrr", label: "MRR" },
  { key: "churn", label: "Churn" },
] as const satisfies readonly { key: TrajectoryMetric; label: string }[]

export const TRAJECTORY_RANGES = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
] as const satisfies readonly { key: TrajectoryRange; label: string }[]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_ALL_TIME_MONTHS = 120

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
})
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

type Bucket = {
  start: Date
  end: Date
  label: string
}

function startOfUtcHour(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()),
  )
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcWeek(date: Date) {
  const day = startOfUtcDay(date)
  const mondayOffset = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - mondayOffset * DAY_MS)
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function utcMonthDifference(from: Date, to: Date) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
}

function createBuckets(range: TrajectoryRange, now: Date, firstEventAt: Date | null): Bucket[] {
  if (range === "24h") {
    const currentHour = startOfUtcHour(now)
    return Array.from({ length: 24 }, (_, index) => {
      const start = new Date(currentHour.getTime() - (23 - index) * HOUR_MS)
      return { start, end: new Date(start.getTime() + HOUR_MS), label: hourFormatter.format(start) }
    })
  }

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30
    const today = startOfUtcDay(now)
    return Array.from({ length: days }, (_, index) => {
      const start = new Date(today.getTime() - (days - 1 - index) * DAY_MS)
      return { start, end: new Date(start.getTime() + DAY_MS), label: dayFormatter.format(start) }
    })
  }

  if (range === "3m") {
    const currentWeek = startOfUtcWeek(now)
    return Array.from({ length: 13 }, (_, index) => {
      const start = new Date(currentWeek.getTime() - (12 - index) * 7 * DAY_MS)
      return {
        start,
        end: new Date(start.getTime() + 7 * DAY_MS),
        label: dayFormatter.format(start),
      }
    })
  }

  if (range === "6m" || range === "12m") {
    const months = range === "6m" ? 6 : 12
    const currentMonth = startOfUtcMonth(now)
    return Array.from({ length: months }, (_, index) => {
      const start = addUtcMonths(currentMonth, -(months - 1 - index))
      return { start, end: addUtcMonths(start, 1), label: monthFormatter.format(start) }
    })
  }

  if (!firstEventAt) return []

  const currentMonth = startOfUtcMonth(now)
  let firstMonth = startOfUtcMonth(firstEventAt)
  let months = utcMonthDifference(firstMonth, currentMonth) + 1
  if (months <= 0) return []
  if (months > MAX_ALL_TIME_MONTHS) {
    firstMonth = addUtcMonths(currentMonth, -(MAX_ALL_TIME_MONTHS - 1))
    months = MAX_ALL_TIME_MONTHS
  }

  return Array.from({ length: months }, (_, index) => {
    const start = addUtcMonths(firstMonth, index)
    return { start, end: addUtcMonths(start, 1), label: monthFormatter.format(start) }
  })
}

function findBucketIndex(buckets: Bucket[], date: Date) {
  let low = 0
  let high = buckets.length - 1

  while (low <= high) {
    const middle = (low + high) >> 1
    const bucket = buckets[middle]
    if (date < bucket.start) high = middle - 1
    else if (date >= bucket.end) low = middle + 1
    else return middle
  }

  return -1
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100
}

export function selectTrajectoryCurrency(
  events: ChargeTrajectoryEvent[],
  preferredCurrency: string | null,
) {
  if (preferredCurrency) {
    const preferred = preferredCurrency.toLowerCase()
    if (events.some((event) => event.currency.toLowerCase() === preferred)) return preferred
  }

  const totals = new Map<string, bigint>()
  for (const event of events) {
    const currency = event.currency.toLowerCase()
    totals.set(currency, (totals.get(currency) ?? BigInt(0)) + event.amountCapturedMinor)
  }

  let selected = preferredCurrency?.toLowerCase() ?? "usd"
  let selectedTotal = BigInt(-1)
  for (const [currency, total] of totals) {
    if (total > selectedTotal) {
      selected = currency
      selectedTotal = total
    }
  }

  return selected
}

export function buildChargeTrajectories(
  events: ChargeTrajectoryEvent[],
  currency: string,
  now = new Date(),
): TrajectorySeries {
  const normalizedCurrency = currency.toLowerCase()
  const matchingEvents = events.filter(
    (event) => event.currency.toLowerCase() === normalizedCurrency,
  )
  const firstEventAt = matchingEvents.reduce<Date | null>(
    (earliest, event) => (!earliest || event.occurredAt < earliest ? event.occurredAt : earliest),
    null,
  )
  const series = {} as TrajectorySeries

  for (const range of TRAJECTORY_RANGES) {
    const buckets = createBuckets(range.key, now, firstEventAt)
    if (buckets.length === 0) {
      series[range.key] = { revenue: [], mrr: [], churn: [] }
      continue
    }

    const revenue = new Array<number>(buckets.length).fill(0)
    const mrr = new Array<number>(buckets.length).fill(0)
    const customers = Array.from({ length: buckets.length }, () => new Set<string>())

    for (const event of matchingEvents) {
      const index = findBucketIndex(buckets, event.occurredAt)
      if (index === -1) continue

      const amount = toMajorUnits(event.amountCapturedMinor, normalizedCurrency)
      revenue[index] += amount
      if (event.isRecurring) mrr[index] += amount
      if (event.customerHash) customers[index].add(event.customerHash)
    }

    const churn = new Array<number | null>(buckets.length).fill(null)
    for (let index = 1; index < buckets.length; index += 1) {
      const priorCustomers = customers[index - 1]
      if (priorCustomers.size === 0) continue

      const currentCustomers = customers[index]
      let retained = 0
      for (const customer of priorCustomers) {
        if (currentCustomers.has(customer)) retained += 1
      }
      churn[index] = ((priorCustomers.size - retained) / priorCustomers.size) * 100
    }

    series[range.key] = {
      revenue: buckets.map((bucket, index) => ({
        label: bucket.label,
        value: roundValue(revenue[index]),
      })),
      mrr: buckets.map((bucket, index) => ({
        label: bucket.label,
        value: roundValue(mrr[index]),
      })),
      churn: buckets.map((bucket, index) => ({
        label: bucket.label,
        value: churn[index] === null ? null : roundValue(churn[index]!),
      })),
    }
  }

  return series
}
