import {
  appendCatalogItem,
  asRecord,
  collectJsonPages,
  finishProviderSync,
  getBoolean,
  getList,
  getRecord,
  getString,
  jsonHeaders,
} from "../common"
import {
  createCurrencyMetrics,
  createPeriod,
  normalizeCurrency,
  normalizeInterval,
  normalizeIntervalCount,
  parseMinorUnits,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const PADDLE_API = "https://api.paddle.com"

function paddleNextUrl(payload: unknown, items: unknown[], page: number, path: string, params: URLSearchParams) {
  const root = asRecord(payload)
  const meta = getRecord(root, "meta")
  const pagination = getRecord(meta, "pagination")
  if (getBoolean(pagination, "has_more") === false) return null

  const next = getString(pagination, "next")
  if (next) return next
  if (getBoolean(pagination, "has_more") === true && items.length > 0) {
    const last = asRecord(items[items.length - 1])
    const id = getString(last, "id")
    if (!id) return null
    const nextParams = new URLSearchParams(params)
    nextParams.set("after", id)
    return `${PADDLE_API}/${path}?${nextParams.toString()}`
  }
  return null
}

async function listPaddle(path: string, params: URLSearchParams, apiKey: string) {
  const firstUrl = `${PADDLE_API}/${path}?${params.toString()}`
  return collectJsonPages(
    firstUrl,
    jsonHeaders(apiKey),
    (payload, items, page) => paddleNextUrl(payload, items, page, path, params),
  )
}

function activeStatus(value: unknown) {
  return typeof value === "string" && ["active", "trialing"].includes(value.toLowerCase())
}

export async function syncPaddle(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const apiKey = credentials.apiKey
  const period = createPeriod()
  const productsParams = new URLSearchParams({ per_page: "200", include: "prices" })
  const transactionParams = new URLSearchParams({
    per_page: "30",
    status: "completed",
    include: "adjustments_totals",
    "created_at[GT]": period.startIso,
  })
  const subscriptionParams = new URLSearchParams({ per_page: "200", status: "active" })

  const [products, transactions, subscriptions] = await Promise.all([
    listPaddle("products", productsParams, apiKey),
    listPaddle("transactions", transactionParams, apiKey),
    listPaddle("subscriptions", subscriptionParams, apiKey),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const productNames = new Map<string, string>()
  const syncedAt = new Date()

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "id")
    const name = getString(product, "name")
    if (!id || !name) continue
    productNames.set(id, name)

    const active = getString(product, "status") !== "archived"
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      active,
      lastSyncedAt: syncedAt,
    })

    for (const priceValue of getList(product, "prices")) {
      const price = asRecord(priceValue)
      if (!price) continue
      const unitPrice = getRecord(price, "unit_price")
      const billingCycle = getRecord(price, "billing_cycle")
      const priceId = getString(price, "id")
      if (!priceId) continue
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: priceId,
        productExternalId: getString(price, "product_id") || id,
        name: getString(price, "name", "description") || name,
        amountMinor: parseMinorUnits(unitPrice?.amount),
        currency: normalizeCurrency(getString(unitPrice, "currency_code")),
        billingInterval: normalizeInterval(getString(billingCycle, "interval")),
        intervalCount: normalizeIntervalCount(billingCycle?.frequency),
        active: getString(price, "status") !== "archived",
        lastSyncedAt: syncedAt,
      })
    }
  }

  for (const item of transactions) {
    const transaction = asRecord(item)
    if (!transaction || !["completed", "paid"].includes(getString(transaction, "status") ?? "")) continue
    const currency = normalizeCurrency(getString(transaction, "currency_code"))
    const totals = getRecord(transaction, "totals")
    const adjustmentTotals = getRecord(transaction, "adjustments_totals")
    const breakdown = getRecord(adjustmentTotals, "breakdown")
    metrics.addCharge({
      currency,
      grossMinor: parseMinorUnits(totals?.total ?? transaction.total),
      refundedMinor: parseMinorUnits(breakdown?.refund),
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const subscription = asRecord(item)
    if (!subscription || !activeStatus(subscription.status)) continue
    const subscriptionId = getString(subscription, "id")
    const subscriptionItems = getList(subscription, "items")

    if (subscriptionItems.length === 0) {
      const billingCycle = getRecord(subscription, "billing_cycle")
      metrics.addActiveSubscription({
        currency: getString(subscription, "currency_code"),
        id: subscriptionId,
        amountMinor: null,
        interval: normalizeInterval(getString(billingCycle, "interval")),
        intervalCount: normalizeIntervalCount(billingCycle?.frequency),
      })
      continue
    }

    for (const subscriptionItemValue of subscriptionItems) {
      const subscriptionItem = asRecord(subscriptionItemValue)
      const price = getRecord(subscriptionItem, "price")
      const unitPrice = getRecord(price, "unit_price")
      const billingCycle = getRecord(price, "billing_cycle")
      if (!subscriptionItem) continue

      metrics.addActiveSubscription({
        currency: getString(unitPrice, "currency_code") ?? getString(subscription, "currency_code"),
        id: subscriptionId,
        amountMinor: parseMinorUnits(unitPrice?.amount),
        interval: normalizeInterval(getString(billingCycle, "interval")),
        intervalCount: normalizeIntervalCount(billingCycle?.frequency),
        quantity: normalizeIntervalCount(subscriptionItem.quantity),
      })

      const productId = getString(price, "product_id")
      if (price && productId && !productNames.has(productId)) {
        const product = getRecord(subscriptionItem, "product")
        const name = getString(product, "name")
        if (name) productNames.set(productId, name)
      }
    }
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
