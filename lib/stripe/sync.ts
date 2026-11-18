import "server-only"

import Stripe from "stripe"
import { MAX_STORED_CHARGES } from "@/lib/charge-trajectories"
import { hashProviderCustomerId } from "./crypto"

const MAX_BILLING_RECORDS = 500
const CATALOG_PAGE_SIZE = 100

type CurrencyMetrics = {
  grossChargeAmountMinor: bigint
  refundedAmountMinor: bigint
  successfulChargeCount: number
  activeSubscriptionIds: Set<string>
  mrrMinor: bigint
}

export type StripeRevenueSnapshot = {
  periodStart: string
  periodEnd: string
  currency: string
  grossChargeAmountMinor: bigint
  refundedAmountMinor: bigint
  successfulChargeCount: number
  activeSubscriptionCount: number
  mrrMinor: bigint
}

export type StripeProductRecord = {
  stripeProductId: string
  name: string
  active: boolean
  lastSyncedAt: Date
}

export type StripePlanRecord = {
  stripePlanId: string
  stripeProductId: string | null
  nickname: string | null
  amountMinor: bigint
  currency: string
  billingInterval: "day" | "week" | "month" | "year"
  intervalCount: number
  active: boolean
  lastSyncedAt: Date
}

export type StripeChargeEvent = {
  chargeId: string
  occurredAt: Date
  currency: string
  amountCapturedMinor: bigint
  isRecurring: boolean
  customerHash: string | null
}

export type InitialStripeData = {
  snapshots: StripeRevenueSnapshot[]
  products: StripeProductRecord[]
  plans: StripePlanRecord[]
  chargeEvents: StripeChargeEvent[]
  rawPayload: unknown
}

export class StripeSyncLimitError extends Error {
  constructor() {
    super("Stripe initial sync exceeded its record limit")
    this.name = "StripeSyncLimitError"
  }
}

async function collectBounded<T>(records: AsyncIterable<T>, maxRecords: number) {
  const collected: T[] = []
  for await (const record of records) {
    if (collected.length >= maxRecords) throw new StripeSyncLimitError()
    collected.push(record)
  }
  return collected
}

async function collectUpTo<T>(records: AsyncIterable<T>, maxRecords: number) {
  const collected: T[] = []
  let truncated = false

  for await (const record of records) {
    if (collected.length >= maxRecords) {
      truncated = true
      break
    }
    collected.push(record)
  }

  return { records: collected, truncated }
}

function customerIdOf(charge: Stripe.Charge) {
  if (!charge.customer) return null
  return typeof charge.customer === "string" ? charge.customer : charge.customer.id
}

function isRecurringCharge(charge: Stripe.Charge) {
  // Stripe's current charge resource does not expose an invoice ID, so the
  // charge description is the only available recurring-payment signal.
  return /subscription/i.test(charge.description ?? "")
}

function currencyMetricsByCode() {
  const metrics = new Map<string, CurrencyMetrics>()

  return {
    get(currency: string) {
      const code = currency.toLowerCase()
      if (!/^[a-z]{3}$/.test(code)) return null
      let value = metrics.get(code)
      if (!value) {
        value = {
          grossChargeAmountMinor: BigInt(0),
          refundedAmountMinor: BigInt(0),
          successfulChargeCount: 0,
          activeSubscriptionIds: new Set<string>(),
          mrrMinor: BigInt(0),
        }
        metrics.set(code, value)
      }
      return value
    },
    entries() {
      return [...metrics.entries()]
    },
  }
}

function amountToMinorUnits(price: Stripe.Price) {
  if (price.unit_amount !== null) return BigInt(price.unit_amount)
  if (price.unit_amount_decimal === null) return null

  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(price.unit_amount_decimal))
  if (!match) return null

  const whole = BigInt(match[1])
  const fraction = match[2] ?? ""
  return whole + (fraction.length > 0 && Number(fraction[0]) >= 5 ? BigInt(1) : BigInt(0))
}

function monthlyAmount(
  amountMinor: bigint,
  interval: "day" | "week" | "month" | "year",
  intervalCount: number,
  quantity: number,
) {
  if (!Number.isSafeInteger(intervalCount) || intervalCount < 1) return BigInt(0)
  if (!Number.isSafeInteger(quantity) || quantity < 1) return BigInt(0)

  const count = BigInt(intervalCount)
  const quantityValue = BigInt(quantity)
  const multiplier = interval === "week" ? BigInt(52) : interval === "day" ? BigInt(365) : BigInt(1)
  const divisor = interval === "year" || interval === "week" || interval === "day" ? BigInt(12) : BigInt(1)
  const numerator = amountMinor * quantityValue * multiplier
  const denominator = count * divisor
  return (numerator + denominator / BigInt(2)) / denominator
}

function cleanLabel(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength)
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isBillingInterval(value: unknown): value is StripePlanRecord["billingInterval"] {
  return value === "day" || value === "week" || value === "month" || value === "year"
}

export async function syncInitialStripeData(stripe: Stripe): Promise<InitialStripeData> {
  const periodEndDate = new Date()
  const periodStartDate = new Date(periodEndDate.getTime() - 30 * 24 * 60 * 60 * 1000)
  const periodStart = dateKey(periodStartDate)
  const periodEnd = dateKey(periodEndDate)
  const createdGte = Math.floor(periodStartDate.getTime() / 1000)

  const [recentCharges, historyResult, refunds, subscriptions, productPage, pricePage] = await Promise.all([
    collectBounded(
      stripe.charges.list({ created: { gte: createdGte }, limit: 100 }),
      MAX_BILLING_RECORDS,
    ),
    collectUpTo(stripe.charges.list({ limit: 100 }), MAX_STORED_CHARGES),
    collectBounded(
      stripe.refunds.list({ created: { gte: createdGte }, limit: 100 }),
      MAX_BILLING_RECORDS,
    ),
    collectBounded(
      stripe.subscriptions.list({ status: "active", limit: 100 }),
      MAX_BILLING_RECORDS,
    ),
    stripe.products.list({ active: true, limit: CATALOG_PAGE_SIZE }),
    stripe.prices.list({ active: true, type: "recurring", limit: CATALOG_PAGE_SIZE }),
  ])
  const historyCharges = historyResult.records

  const byCurrency = currencyMetricsByCode()

  for (const charge of recentCharges) {
    // Failed, uncaptured, and unpaid charges never count as revenue.
    if (charge.status !== "succeeded" || !charge.paid || !charge.captured) continue
    const metrics = byCurrency.get(charge.currency)
    if (!metrics) continue
    metrics.grossChargeAmountMinor += BigInt(charge.amount_captured ?? charge.amount)
    metrics.successfulChargeCount += 1
  }

  for (const refund of refunds) {
    if (refund.status !== "succeeded") continue
    const metrics = byCurrency.get(refund.currency)
    if (!metrics) continue
    metrics.refundedAmountMinor += BigInt(refund.amount)
  }

  const subscriptionItemResponses: Array<{
    subscriptionId: string
    items: Stripe.SubscriptionItem[]
  }> = []

  for (const subscription of subscriptions) {
    let items = subscription.items.data
    if (subscription.items.has_more) {
      items = await collectBounded(
        stripe.subscriptionItems.list({ subscription: subscription.id, limit: 100 }),
        100,
      )
    }
    subscriptionItemResponses.push({ subscriptionId: subscription.id, items })

    const currencies = new Set<string>()
    for (const item of items) {
      const price = item.price
      const interval = price.recurring?.interval
      const intervalCount = price.recurring?.interval_count ?? 1
      const amountMinor = amountToMinorUnits(price)
      if (!price.active || !isBillingInterval(interval) || amountMinor === null) continue

      const metrics = byCurrency.get(price.currency)
      if (!metrics) continue
      const quantity = item.quantity ?? 1
      metrics.mrrMinor += monthlyAmount(amountMinor, interval, intervalCount, quantity)
      currencies.add(price.currency.toLowerCase())
    }
    for (const currency of currencies) {
      byCurrency.get(currency)?.activeSubscriptionIds.add(subscription.id)
    }
  }

  const syncedAt = new Date()
  const snapshots = byCurrency.entries()
    .map(([currency, metrics]) => ({
      periodStart,
      periodEnd,
      currency,
      grossChargeAmountMinor: metrics.grossChargeAmountMinor,
      refundedAmountMinor: metrics.refundedAmountMinor,
      successfulChargeCount: metrics.successfulChargeCount,
      activeSubscriptionCount: metrics.activeSubscriptionIds.size,
      mrrMinor: metrics.mrrMinor,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))

  const products: StripeProductRecord[] = productPage.data
    .filter((product) => product.active)
    .map((product) => ({
      stripeProductId: product.id,
      name: cleanLabel(product.name, 200) || "Untitled product",
      active: true,
      lastSyncedAt: syncedAt,
    }))

  const productNames = new Map(products.map((product) => [product.stripeProductId, product.name]))
  const plans: StripePlanRecord[] = pricePage.data.flatMap((price) => {
    const recurring = price.recurring
    const amountMinor = amountToMinorUnits(price)
    if (!price.active || !recurring || amountMinor === null) return []

    const interval = recurring.interval
    if (!isBillingInterval(interval)) return []
    const productId = typeof price.product === "string" ? price.product : price.product.id
    const nickname = price.nickname ? cleanLabel(price.nickname, 200) : null

    return [{
      stripePlanId: price.id,
      stripeProductId: productId,
      nickname: nickname || productNames.get(productId) || null,
      amountMinor,
      currency: price.currency.toLowerCase(),
      billingInterval: interval,
      intervalCount: recurring.interval_count,
      active: true,
      lastSyncedAt: syncedAt,
    }]
  })

  const chargeEvents: StripeChargeEvent[] = historyCharges.flatMap((charge) => {
    if (charge.status !== "succeeded" || !charge.paid || !charge.captured) return []

    const customerId = customerIdOf(charge)
    return [{
      chargeId: charge.id,
      occurredAt: new Date(charge.created * 1000),
      currency: charge.currency.toLowerCase(),
      amountCapturedMinor: BigInt(charge.amount_captured ?? charge.amount),
      isRecurring: isRecurringCharge(charge),
      customerHash: customerId ? hashProviderCustomerId("stripe", customerId) : null,
    }]
  })

  return {
    snapshots,
    products,
    plans,
    chargeEvents,
    rawPayload: {
      charges: historyCharges,
      chargesTruncated: historyResult.truncated,
      refunds,
      subscriptions,
      subscriptionItemResponses,
      products: productPage,
      prices: pricePage,
    },
  }
}
