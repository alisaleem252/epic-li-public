import {
  appendCatalogItem,
  asRecord,
  collectJsonPages,
  finishProviderSync,
  getBoolean,
  getRecord,
  getString,
  jsonHeaders,
  ProviderSyncLimitError,
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

const DODO_API = "https://live.dodopayments.com"
const PAGE_SIZE = 100

function dodoNextUrl(payload: unknown, items: unknown[], page: number, path: string, extra: Record<string, string> = {}) {
  const root = asRecord(payload)
  const pagination = getRecord(root, "pagination")
  const totalPages = parseCount(root?.total_pages ?? pagination?.total_pages)
  const hasMore = getBoolean(root, "has_more") ?? getBoolean(pagination, "has_more")
  if (hasMore === false) return null
  if (totalPages > page + 1 || items.length === PAGE_SIZE || hasMore === true) {
    const nextPage = page + 1
    const url = new URL(`${DODO_API}/${path}`)
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value)
    url.searchParams.set("page_number", String(nextPage))
    url.searchParams.set("page_size", String(PAGE_SIZE))
    return url.toString()
  }
  return null
}

async function listDodo(path: string, token: string, extra: Record<string, string> = {}) {
  const firstUrl = new URL(`${DODO_API}/${path}`)
  for (const [key, value] of Object.entries(extra)) firstUrl.searchParams.set(key, value)
  firstUrl.searchParams.set("page_number", "0")
  firstUrl.searchParams.set("page_size", String(PAGE_SIZE))

  return collectJsonPages(
    firstUrl.toString(),
    jsonHeaders(token),
    (payload, items, page) => dodoNextUrl(payload, items, page, path, extra),
    { maxPages: 8 },
  )
}

function isWithinPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

export async function syncDodoPayments(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const token = credentials.apiKey
  const period = createPeriod()
  const [products, payments, subscriptions] = await Promise.all([
    listDodo("products", token),
    listDodo("payments", token, { created_at_gte: period.startIso }),
    listDodo("subscriptions", token),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()
  const productsById = new Map<string, string>()

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "product_id", "id")
    const name = getString(product, "name", "product_name")
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

    const recurring = getBoolean(product, "recurring") === true || Boolean(
      getString(product, "payment_frequency_interval", "billing_interval", "recurring_interval"),
    )
    if (recurring) {
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: id,
        productExternalId: id,
        name,
        amountMinor: parseMinorUnits(product.price ?? product.amount ?? product.total_amount),
        currency: normalizeCurrency(getString(product, "currency")),
        billingInterval: normalizeInterval(
          getString(product, "payment_frequency_interval", "billing_interval", "recurring_interval"),
        ),
        intervalCount: normalizeIntervalCount(
          product.payment_frequency_count ?? product.billing_interval_count ?? product.interval_count,
        ),
        active,
        lastSyncedAt: syncedAt,
      })
    }
  }

  for (const item of payments) {
    const payment = asRecord(item)
    if (!payment) continue
    const status = getString(payment, "status", "payment_status")
    if (!status || !["succeeded", "captured", "paid", "completed"].includes(status)) continue
    if (!isWithinPeriod(getString(payment, "created_at", "payment_date", "created"), period.start, period.end)) continue

    const refunded = parseMinorUnits(
      payment.refunded_amount ?? payment.amount_refunded ?? payment.refund_amount,
    )
    metrics.addCharge({
      currency: getString(payment, "currency", "currency_code"),
      grossMinor: parseMinorUnits(payment.total_amount ?? payment.amount ?? payment.total),
      refundedMinor: refunded,
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const subscription = asRecord(item)
    if (!subscription || getString(subscription, "status") !== "active") continue

    const productId = getString(subscription, "product_id")
    const interval = normalizeInterval(
      getString(subscription, "payment_frequency_interval", "recurring_interval", "billing_interval"),
    )
    metrics.addActiveSubscription({
      currency: getString(subscription, "currency", "currency_code"),
      id: getString(subscription, "subscription_id", "id"),
      amountMinor: parseMinorUnits(
        subscription.recurring_pre_tax_amount ?? subscription.amount ?? subscription.price,
      ),
      interval,
      intervalCount: normalizeIntervalCount(
        subscription.payment_frequency_count ?? subscription.recurring_interval_count ?? subscription.interval_count,
      ),
      quantity: normalizeIntervalCount(subscription.quantity),
    })

    if (productId && !productsById.has(productId)) {
      const productName = getString(subscription, "product_name")
      if (productName) productsById.set(productId, productName)
    }
  }

  if (catalogItems.length > 500) throw new ProviderSyncLimitError()
  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
