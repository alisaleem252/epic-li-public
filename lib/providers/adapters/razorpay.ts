import {
  appendCatalogItem,
  asRecord,
  collectJsonPages,
  finishProviderSync,
  getRecord,
  getString,
  ProviderAuthenticationError,
} from "../common"
import {
  createCurrencyMetrics,
  createPeriod,
  normalizeCurrency,
  normalizeInterval,
  normalizeIntervalCount,
  parseCount,
  parseMinorUnits,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const RAZORPAY_API = "https://api.razorpay.com/v1"
const PAGE_SIZE = 100

function razorpayHeaders(keyId: string, keySecret: string) {
  const basic = Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64")
  return {
    Accept: "application/json",
    Authorization: `Basic ${basic}`,
  }
}

function nextRazorpayUrl(path: string, page: number, params: URLSearchParams, items: unknown[]) {
  if (items.length < PAGE_SIZE) return null
  const nextParams = new URLSearchParams(params)
  nextParams.set("skip", String((page + 1) * PAGE_SIZE))
  return `${RAZORPAY_API}/${path}?${nextParams.toString()}`
}

async function listRazorpay(path: string, headers: HeadersInit, params: URLSearchParams) {
  const firstParams = new URLSearchParams(params)
  firstParams.set("count", String(PAGE_SIZE))
  firstParams.set("skip", "0")
  const firstUrl = `${RAZORPAY_API}/${path}?${firstParams.toString()}`
  return collectJsonPages(
    firstUrl,
    headers,
    (_payload, items, page) => nextRazorpayUrl(path, page, firstParams, items),
    { maxPages: 8 },
  )
}

function withinUnixRange(value: unknown, start: number, end: number) {
  const timestamp = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isSafeInteger(timestamp) && timestamp >= start && timestamp <= end
}

function razorpayInterval(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.toLowerCase()
  if (normalized === "daily") return "day" as const
  if (normalized === "weekly") return "week" as const
  if (normalized === "monthly") return "month" as const
  if (normalized === "yearly" || normalized === "annual") return "year" as const
  return normalizeInterval(value)
}

export async function syncRazorpay(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const keyId = credentials.keyId
  const keySecret = credentials.keySecret
  if (!keyId.startsWith("rzp_live_")) throw new ProviderAuthenticationError()

  const period = createPeriod()
  const params = new URLSearchParams({ from: String(period.startUnix), to: String(period.endUnix) })
  const headers = razorpayHeaders(keyId, keySecret)
  const [payments, subscriptions, plans, items] = await Promise.all([
    listRazorpay("payments", headers, params),
    listRazorpay("subscriptions", headers, new URLSearchParams()),
    listRazorpay("plans", headers, new URLSearchParams()),
    listRazorpay("items", headers, new URLSearchParams()),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()
  const plansById = new Map<string, Record<string, unknown>>()
  const itemsById = new Map<string, string>()

  for (const item of items) {
    const catalogItem = asRecord(item)
    if (!catalogItem) continue
    const id = getString(catalogItem, "id")
    const name = getString(catalogItem, "name")
    if (!id || !name) continue
    itemsById.set(id, name)
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      amountMinor: parseMinorUnits(catalogItem.amount),
      currency: normalizeCurrency(getString(catalogItem, "currency")),
      active: getString(catalogItem, "status") !== "inactive",
      lastSyncedAt: syncedAt,
    })
  }

  for (const item of plans) {
    const plan = asRecord(item)
    if (!plan) continue
    const id = getString(plan, "id")
    if (!id) continue
    plansById.set(id, plan)
    const planItem = getRecord(plan, "item")
    const productId = getString(planItem, "id")
    const interval = razorpayInterval(plan.period)
    appendCatalogItem(catalogItems, {
      itemKind: "plan",
      externalId: id,
      productExternalId: productId,
      name: getString(planItem, "name") || (productId ? itemsById.get(productId) : null) || "Subscription plan",
      amountMinor: parseMinorUnits(planItem?.amount ?? plan.amount),
      currency: normalizeCurrency(getString(planItem, "currency") ?? getString(plan, "currency")),
      billingInterval: interval,
      intervalCount: normalizeIntervalCount(plan.interval),
      active: getString(plan, "status") !== "inactive",
      lastSyncedAt: syncedAt,
    })
  }

  for (const item of payments) {
    const payment = asRecord(item)
    if (!payment || getString(payment, "status") !== "captured") continue
    if (!withinUnixRange(payment.created_at, period.startUnix, period.endUnix)) continue
    metrics.addCharge({
      currency: getString(payment, "currency"),
      grossMinor: parseMinorUnits(payment.amount),
      refundedMinor: parseMinorUnits(payment.amount_refunded),
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const subscription = asRecord(item)
    if (!subscription || getString(subscription, "status") !== "active") continue
    const planId = getString(subscription, "plan_id")
    const plan = planId ? plansById.get(planId) : null
    const planItem = getRecord(plan, "item")
    metrics.addActiveSubscription({
      currency: getString(planItem, "currency") ?? getString(plan, "currency"),
      id: getString(subscription, "id"),
      amountMinor: parseMinorUnits(planItem?.amount ?? plan?.amount),
      interval: razorpayInterval(plan?.period),
      intervalCount: normalizeIntervalCount(plan?.interval),
      quantity: normalizeIntervalCount(subscription.quantity),
    })
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
