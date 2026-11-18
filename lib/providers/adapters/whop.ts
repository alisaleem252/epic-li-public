import {
  appendCatalogItem,
  asRecord,
  collectJsonPages,
  finishProviderSync,
  getBoolean,
  getRecord,
  getString,
  ProviderUnavailableError,
} from "../common"
import {
  createCurrencyMetrics,
  createPeriod,
  normalizeCurrency,
  parseCount,
  parseMajorUnits,
  toMonthlyAmountMinor,
  type BillingInterval,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const WHOP_API = "https://api.whop.com/api/v1"
const WHOP_API_VERSION = "2026-07-01"
const PAGE_SIZE = 100

function whopHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Api-Version-Date": WHOP_API_VERSION,
  }
}

function whopNextUrl(payload: unknown, items: unknown[], path: string, params: URLSearchParams) {
  const root = asRecord(payload)
  const pageInfo = getRecord(root, "page_info")
  if (getBoolean(pageInfo, "has_next_page") !== true) return null
  const cursor = getString(pageInfo, "end_cursor")
  if (!cursor) return null
  const nextParams = new URLSearchParams(params)
  nextParams.set("first", String(PAGE_SIZE))
  nextParams.set("after", cursor)
  return `${WHOP_API}/${path}?${nextParams.toString()}`
}

async function listWhop(path: string, apiKey: string, queryParams: Record<string, string> = {}) {
  const params = new URLSearchParams({ first: String(PAGE_SIZE), ...queryParams })
  const firstUrl = `${WHOP_API}/${path}?${params.toString()}`
  return collectJsonPages(
    firstUrl,
    whopHeaders(apiKey),
    (payload, items) => whopNextUrl(payload, items, path, params),
    { maxPages: 12 },
  )
}

function isWithinPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

function whopBillingCycle(value: unknown): { interval: BillingInterval; intervalCount: number } | null {
  const days = parseCount(value)
  if (days < 1) return null
  if (days % 365 === 0) return { interval: "year", intervalCount: days / 365 }
  if (days % 30 === 0) return { interval: "month", intervalCount: days / 30 }
  if (days % 7 === 0) return { interval: "week", intervalCount: days / 7 }
  return { interval: "day", intervalCount: days }
}

export async function syncWhop(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const apiKey = credentials.apiKey
  const accountId = credentials.accountId
  if (!/^biz_[A-Za-z0-9_-]{4,120}$/.test(accountId)) throw new ProviderUnavailableError()

  const period = createPeriod()
  const [products, plans, payments] = await Promise.all([
    listWhop("products", apiKey, { account_id: accountId, visibilities: "visible" }),
    listWhop("plans", apiKey, { account_id: accountId, visibilities: "visible" }),
    listWhop("payments", apiKey, { created_after: period.startIso }),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()
  const productsById = new Map<string, string>()

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "id", "product_id")
    const name = getString(product, "title", "name", "headline")
    const visibility = getString(product, "visibility")
    if (!id || !name || visibility !== "visible") continue
    productsById.set(id, name)
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      active: true,
      lastSyncedAt: syncedAt,
    })
  }

  for (const item of plans) {
    const plan = asRecord(item)
    if (!plan) continue
    const id = getString(plan, "id")
    const product = getRecord(plan, "product")
    const productId = getString(product, "id") ?? getString(plan, "product_id")
    const visibility = getString(plan, "visibility")
    if (!id || visibility !== "visible") continue
    if (productId && productsById.size > 0 && !productsById.has(productId)) continue

    const planType = getString(plan, "plan_type", "billing_type")?.toLowerCase()
    const isRecurring = planType === "renewal"
    const currency = normalizeCurrency(getString(plan, "currency", "currency_code"))
    const billingCycle = whopBillingCycle(plan.billing_period)
    const amountMinor = parseMajorUnits(
      isRecurring ? plan.renewal_price : plan.initial_price,
      currency ?? "usd",
    )
    const activeSubscriptionCount = isRecurring ? parseCount(plan.member_count) : 0
    const mrrMinor = isRecurring && billingCycle && amountMinor !== null
      ? toMonthlyAmountMinor(amountMinor, billingCycle.interval, billingCycle.intervalCount, activeSubscriptionCount)
      : null

    appendCatalogItem(catalogItems, {
      itemKind: "plan",
      externalId: id,
      productExternalId: productId,
      name: getString(plan, "title", "name") || (productId ? productsById.get(productId) : null) || "Membership plan",
      amountMinor,
      currency,
      billingInterval: isRecurring ? billingCycle?.interval ?? null : null,
      intervalCount: billingCycle?.intervalCount ?? 1,
      active: true,
      lastSyncedAt: syncedAt,
    })
    metrics.addAggregate({ currency, activeSubscriptionCount, mrrMinor })
  }

  for (const item of payments) {
    const payment = asRecord(item)
    if (!payment) continue
    const status = getString(payment, "status")?.toLowerCase()
    const substatus = getString(payment, "substatus")?.toLowerCase()
    const isSuccessful = ["paid", "succeeded", "completed", "refunded", "partially_refunded"].includes(status ?? "") || substatus === "succeeded"
    if (!isSuccessful) continue
    const companyId = getString(getRecord(payment, "company"), "id", "account_id")
    if (companyId && companyId !== accountId) continue
    if (!isWithinPeriod(getString(payment, "created_at", "paid_at"), period.start, period.end)) continue

    const currency = getString(payment, "currency", "currency_code")
    metrics.addCharge({
      currency,
      grossMinor: parseMajorUnits(payment.total ?? payment.amount ?? payment.total_amount, currency ?? "usd"),
      refundedMinor: parseMajorUnits(payment.refunded_amount ?? payment.amount_refunded, currency ?? "usd"),
      count: 1,
    })
  }


  if (catalogItems.length === 0 && products.length > 0) throw new ProviderUnavailableError()
  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
