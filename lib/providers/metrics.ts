import { currencyFractionDigits } from "@/lib/currency"

export type BillingInterval = "day" | "week" | "month" | "year"

export type ProviderSnapshotRecord = {
  periodStart: string
  periodEnd: string
  currency: string
  grossChargeAmountMinor: bigint
  refundedAmountMinor: bigint
  successfulChargeCount: number
  activeSubscriptionCount: number
  mrrMinor: bigint
}

export type ProviderCatalogRecord = {
  itemKind: "product" | "plan"
  externalId: string
  productExternalId: string | null
  name: string
  amountMinor: bigint | null
  currency: string | null
  billingInterval: BillingInterval | null
  intervalCount: number
  active: boolean
  lastSyncedAt: Date
}

export type ProviderRawResponse =
  | { format: "json"; contentType: string | null; body: unknown }
  | { format: "text"; contentType: string | null; body: string }
  | { format: "binary-base64"; contentType: string | null; body: string }

export type ProviderSyncResult = {
  snapshots: ProviderSnapshotRecord[]
  catalogItems: ProviderCatalogRecord[]
  validatedAt: Date
  rawResponses?: ProviderRawResponse[]
}

type CurrencyMetrics = {
  grossChargeAmountMinor: bigint
  refundedAmountMinor: bigint
  successfulChargeCount: number
  activeSubscriptionIds: Set<string>
  aggregateActiveSubscriptionCount: number
  mrrMinor: bigint
}

export type CurrencyMetricsMap = Map<string, CurrencyMetrics>

export const MAX_PROVIDER_RECORDS = 500
export const PROVIDER_PAGE_SIZE = 100

export function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return null
  const currency = value.trim().toLowerCase()
  return /^[a-z]{3}$/.test(currency) ? currency : null
}

export function cleanProviderLabel(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return ""
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
}

export function parseMinorUnits(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= 0n ? value : null
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null
  try {
    return BigInt(value.trim())
  } catch {
    return null
  }
}

export function parseSignedMinorUnits(value: unknown): bigint | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? BigInt(value) : null
  }
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return null
  try {
    return BigInt(value.trim())
  } catch {
    return null
  }
}

export function parseMajorUnits(value: unknown, currency: string): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null
  const input = String(value).trim()
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input)
  if (!match) return null

  const fractionDigits = currencyFractionDigits(currency)
  const fraction = match[3] ?? ""
  const paddedFraction = (fraction + "0".repeat(fractionDigits)).slice(0, fractionDigits)
  let amount = BigInt(match[2]) * 10n ** BigInt(fractionDigits)
  if (paddedFraction) amount += BigInt(paddedFraction)
  if (fraction.length > fractionDigits && Number(fraction[fractionDigits]) >= 5) amount += 1n
  return match[1] === "-" ? -amount : amount
}

export function parseCount(value: unknown) {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

export function normalizeInterval(value: unknown): BillingInterval | null {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (["day", "daily"].includes(normalized)) return "day"
  if (["week", "weekly"].includes(normalized)) return "week"
  if (["month", "monthly"].includes(normalized)) return "month"
  if (["year", "yearly", "annual", "annually"].includes(normalized)) return "year"
  return null
}

export function normalizeIntervalCount(value: unknown) {
  const count = parseCount(value)
  return count >= 1 && count <= 32_767 ? count : 1
}

export function toMonthlyAmountMinor(
  amountMinor: bigint,
  interval: BillingInterval,
  intervalCount: number,
  quantity: number,
) {
  if (amountMinor < 0n || !Number.isSafeInteger(quantity) || quantity < 1) return 0n

  const count = BigInt(normalizeIntervalCount(intervalCount))
  const quantityValue = BigInt(quantity)
  const multiplier = interval === "week" ? 52n : interval === "day" ? 365n : 1n
  const divisor = interval === "year" || interval === "week" || interval === "day" ? 12n : 1n
  const numerator = amountMinor * quantityValue * multiplier
  const denominator = count * divisor
  return (numerator + denominator / 2n) / denominator
}

export function createCurrencyMetrics() {
  const buckets: CurrencyMetricsMap = new Map()

  function get(currencyValue: unknown) {
    const currency = normalizeCurrency(currencyValue)
    if (!currency) return null
    let bucket = buckets.get(currency)
    if (!bucket) {
      bucket = {
        grossChargeAmountMinor: 0n,
        refundedAmountMinor: 0n,
        successfulChargeCount: 0,
        activeSubscriptionIds: new Set<string>(),
        aggregateActiveSubscriptionCount: 0,
        mrrMinor: 0n,
      }
      buckets.set(currency, bucket)
    }
    return bucket
  }

  return {
    get,
    addCharge(input: {
      currency: unknown
      grossMinor?: bigint | null
      refundedMinor?: bigint | null
      count?: number
    }) {
      const bucket = get(input.currency)
      if (!bucket) return
      if (input.grossMinor && input.grossMinor > 0n) bucket.grossChargeAmountMinor += input.grossMinor
      if (input.refundedMinor && input.refundedMinor > 0n) bucket.refundedAmountMinor += input.refundedMinor
      bucket.successfulChargeCount += parseCount(input.count)
    },
    addActiveSubscription(input: {
      currency: unknown
      id: unknown
      amountMinor?: bigint | null
      interval?: BillingInterval | null
      intervalCount?: number
      quantity?: number
    }) {
      const bucket = get(input.currency)
      if (!bucket) return
      const id = typeof input.id === "string" && input.id ? input.id : `anonymous-${bucket.activeSubscriptionIds.size}`
      bucket.activeSubscriptionIds.add(id)
      if (input.amountMinor !== null && input.amountMinor !== undefined && input.interval) {
        bucket.mrrMinor += toMonthlyAmountMinor(
          input.amountMinor,
          input.interval,
          input.intervalCount ?? 1,
          input.quantity ?? 1,
        )
      }
    },
    addAggregate(input: {
      currency: unknown
      grossMinor?: bigint | null
      refundedMinor?: bigint | null
      chargeCount?: number
      activeSubscriptionCount?: number
      mrrMinor?: bigint | null
    }) {
      const bucket = get(input.currency)
      if (!bucket) return
      if (input.grossMinor && input.grossMinor > 0n) bucket.grossChargeAmountMinor += input.grossMinor
      if (input.refundedMinor && input.refundedMinor > 0n) bucket.refundedAmountMinor += input.refundedMinor
      bucket.successfulChargeCount += parseCount(input.chargeCount)
      bucket.aggregateActiveSubscriptionCount += parseCount(input.activeSubscriptionCount)
      if (input.mrrMinor && input.mrrMinor > 0n) bucket.mrrMinor += input.mrrMinor
    },
    snapshots(periodStart: string, periodEnd: string): ProviderSnapshotRecord[] {
      return [...buckets.entries()]
        .map(([currency, bucket]) => ({
          periodStart,
          periodEnd,
          currency,
          grossChargeAmountMinor: bucket.grossChargeAmountMinor,
          refundedAmountMinor: bucket.refundedAmountMinor,
          successfulChargeCount: bucket.successfulChargeCount,
          activeSubscriptionCount: bucket.activeSubscriptionIds.size + bucket.aggregateActiveSubscriptionCount,
          mrrMinor: bucket.mrrMinor,
        }))
        .sort((left, right) => left.currency.localeCompare(right.currency))
    },
  }
}

export function createPeriod(days = 30) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startUnix: Math.floor(start.getTime() / 1000),
    endUnix: Math.floor(end.getTime() / 1000),
  }
}

export function toCatalogRecord(input: {
  itemKind: "product" | "plan"
  externalId: unknown
  productExternalId?: unknown
  name: unknown
  amountMinor?: bigint | null
  currency?: unknown
  billingInterval?: BillingInterval | null
  intervalCount?: number
  active?: boolean
  lastSyncedAt: Date
}): ProviderCatalogRecord | null {
  const externalId = cleanProviderLabel(input.externalId, 160)
  const name = cleanProviderLabel(input.name, 200)
  if (!externalId || !name) return null

  const productExternalId = typeof input.productExternalId === "string"
    ? cleanProviderLabel(input.productExternalId, 160) || null
    : null

  return {
    itemKind: input.itemKind,
    externalId,
    productExternalId,
    name,
    amountMinor: input.amountMinor !== undefined && input.amountMinor !== null && input.amountMinor >= 0n
      ? input.amountMinor
      : null,
    currency: normalizeCurrency(input.currency),
    billingInterval: input.billingInterval ?? null,
    intervalCount: normalizeIntervalCount(input.intervalCount ?? 1),
    active: input.active ?? true,
    lastSyncedAt: input.lastSyncedAt,
  }
}
