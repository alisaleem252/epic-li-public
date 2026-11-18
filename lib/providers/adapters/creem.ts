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
  normalizeInterval,
  normalizeIntervalCount,
  parseCount,
  parseMinorUnits,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const CREEM_API = "https://api.creem.io/v1"
const PAGE_SIZE = 100

function creemNextUrl(payload: unknown, items: unknown[], page: number, path: string) {
  const root = asRecord(payload)
  const pagination = getRecord(root, "pagination")
  // Creem returns `next_page` as a page NUMBER (or null), not a URL.
  const rawNext = pagination?.next_page
  const nextPageNumber = typeof rawNext === "number" ? rawNext : typeof rawNext === "string" ? Number(rawNext) : NaN
  if (rawNext === null && pagination && "next_page" in pagination) return null
  if (Number.isInteger(nextPageNumber) && nextPageNumber > 0) {
    const url = new URL(`${CREEM_API}/${path}`)
    url.searchParams.set("page_number", String(nextPageNumber))
    url.searchParams.set("page_size", String(PAGE_SIZE))
    return url.toString()
  }
  const totalPages = parseCount(pagination?.total_pages ?? root?.total_pages)
  const hasMore = getBoolean(pagination, "has_more") ?? getBoolean(root, "has_more")
  if (hasMore === false) return null
  if (totalPages > page + 1 || items.length === PAGE_SIZE || hasMore === true) {
    const url = new URL(`${CREEM_API}/${path}`)
    url.searchParams.set("page_number", String(page + 2))
    url.searchParams.set("page_size", String(PAGE_SIZE))
    return url.toString()
  }
  return null
}

async function listCreem(path: string, apiKey: string, status?: string) {
  const url = new URL(`${CREEM_API}/${path}`)
  url.searchParams.set("page_number", "1")
  url.searchParams.set("page_size", String(PAGE_SIZE))
  if (status) url.searchParams.set("status", status)
  return collectJsonPages(
    url.toString(),
    { Accept: "application/json", "x-api-key": apiKey },
    (payload, items, page) => creemNextUrl(payload, items, page, path),
  )
}

function isWithinPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

export async function syncCreem(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const apiKey = credentials.apiKey
  const period = createPeriod()
  const [products, transactions, subscriptions] = await Promise.all([
    listCreem("products/search", apiKey, "active"),
    listCreem("transactions/search", apiKey),
    listCreem("subscriptions/search", apiKey, "active"),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()
  const productsById = new Map<string, string>()

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "id", "product_id")
    const name = getString(product, "name", "product_name", "title")
    if (!id || !name) continue
    productsById.set(id, name)

    const active = getString(product, "status") !== "archived" && getBoolean(product, "is_archived") !== true
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      active,
      lastSyncedAt: syncedAt,
    })

    const recurrence = getRecord(product, "recurrence", "billing_period", "billing_cycle")
    const interval = normalizeInterval(
      getString(product, "billing_period", "billing_interval", "recurring_interval") ??
        getString(recurrence, "interval", "unit", "period"),
    )
    if (interval) {
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: id,
        productExternalId: id,
        name,
        amountMinor: parseMinorUnits(product.amount ?? product.price ?? product.price_amount),
        currency: normalizeCurrency(getString(product, "currency", "currency_code")),
        billingInterval: interval,
        intervalCount: normalizeIntervalCount(
          product.interval_count ?? product.frequency ?? recurrence?.count ?? recurrence?.interval_count,
        ),
        active,
        lastSyncedAt: syncedAt,
      })
    }
  }

  for (const item of transactions) {
    const transaction = asRecord(item)
    if (!transaction) continue
    const status = getString(transaction, "status")?.toLowerCase()
    if (!status || !["paid", "succeeded", "completed", "partially_refunded", "refunded"].includes(status)) continue
    if (!isWithinPeriod(getString(transaction, "created_at", "paid_at"), period.start, period.end)) continue

    metrics.addCharge({
      currency: getString(transaction, "currency", "currency_code"),
      grossMinor: parseMinorUnits(transaction.amount ?? transaction.total_amount ?? transaction.price),
      refundedMinor: parseMinorUnits(
        transaction.refunded_amount ?? transaction.amount_refunded ?? transaction.refund_amount,
      ),
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const subscription = asRecord(item)
    if (!subscription || getString(subscription, "status")?.toLowerCase() !== "active") continue
    const recurrence = getRecord(subscription, "recurrence", "billing_period", "billing_cycle")
    const productId = getString(subscription, "product_id")
    metrics.addActiveSubscription({
      currency: getString(subscription, "currency", "currency_code"),
      id: getString(subscription, "id", "subscription_id"),
      amountMinor: parseMinorUnits(subscription.amount ?? subscription.price ?? subscription.price_amount),
      interval: normalizeInterval(
        getString(subscription, "billing_period", "billing_interval", "recurring_interval") ??
          getString(recurrence, "interval", "unit", "period"),
      ),
      intervalCount: normalizeIntervalCount(
        subscription.interval_count ?? subscription.frequency ?? recurrence?.count ?? recurrence?.interval_count,
      ),
      quantity: normalizeIntervalCount(subscription.quantity),
    })
    if (productId && !productsById.has(productId)) {
      const name = getString(subscription, "product_name")
      if (name) productsById.set(productId, name)
    }
  }

  if (catalogItems.length === 0 && products.length > 0) throw new ProviderUnavailableError()
  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
