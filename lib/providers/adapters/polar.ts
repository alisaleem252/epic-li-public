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

const POLAR_API = "https://api.polar.sh/v1"
const PAGE_SIZE = 100

function polarNextUrl(payload: unknown, path: string, params: URLSearchParams, page: number) {
  const root = asRecord(payload)
  const pagination = getRecord(root, "pagination")
  const maxPage = parseCount(pagination?.max_page)
  if (maxPage > page + 1) {
    const nextParams = new URLSearchParams(params)
    nextParams.set("page", String(page + 2))
    return `${POLAR_API}/${path}/?${nextParams.toString()}`
  }
  return null
}

async function listPolar(path: string, params: URLSearchParams, token: string) {
  const firstParams = new URLSearchParams(params)
  firstParams.set("page", "1")
  firstParams.set("limit", String(PAGE_SIZE))
  const firstUrl = `${POLAR_API}/${path}/?${firstParams.toString()}`

  return collectJsonPages(
    firstUrl,
    jsonHeaders(token),
    (payload, items, page) => {
      const next = polarNextUrl(payload, path, firstParams, page)
      if (next) return next
      return items.length === PAGE_SIZE
        ? `${POLAR_API}/${path}/?${new URLSearchParams({ ...Object.fromEntries(firstParams), page: String(page + 2) }).toString()}`
        : null
    },
  )
}

function isWithinPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

export async function syncPolar(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const token = credentials.organizationToken
  const organizationsParams = new URLSearchParams()
  const organizations = await listPolar("organizations", organizationsParams, token)
  const requestedOrganizationId = credentials.organizationId || null
  const organization = organizations.find((item) => {
    const record = asRecord(item)
    return !requestedOrganizationId || getString(record, "id") === requestedOrganizationId
  })
  const organizationId = getString(asRecord(organization), "id")
  if (!organizationId) throw new ProviderUnavailableError()

  const period = createPeriod()
  const productsParams = new URLSearchParams({ organization_id: organizationId })
  const ordersParams = new URLSearchParams({
    organization_id: organizationId,
    created_after: period.startIso,
    created_before: period.endIso,
    sorting: "-created_at",
  })
  const subscriptionsParams = new URLSearchParams({
    organization_id: organizationId,
    status: "active",
    sorting: "-started_at",
  })

  const [products, orders, subscriptions] = await Promise.all([
    listPolar("products", productsParams, token),
    listPolar("orders", ordersParams, token),
    listPolar("subscriptions", subscriptionsParams, token),
  ])

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()

  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "id")
    const name = getString(product, "name")
    if (!id || !name) continue

    const active = getBoolean(product, "is_archived") !== true
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      active,
      lastSyncedAt: syncedAt,
    })

    const prices = getList(product, "prices")
    for (const priceValue of prices) {
      const price = asRecord(priceValue)
      if (!price) continue
      const priceId = getString(price, "id")
      if (!priceId) continue
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: priceId,
        productExternalId: id,
        name: getString(price, "name") || name,
        amountMinor: parseMinorUnits(price.price_amount ?? price.amount),
        currency: normalizeCurrency(getString(price, "price_currency", "currency")),
        billingInterval: normalizeInterval(getString(price, "recurring_interval", "interval")),
        intervalCount: normalizeIntervalCount(price.recurring_interval_count ?? price.interval_count),
        active: getBoolean(price, "is_archived") !== true,
        lastSyncedAt: syncedAt,
      })
    }

    const recurringInterval = normalizeInterval(getString(product, "recurring_interval"))
    if (prices.length === 0 && recurringInterval) {
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: id,
        productExternalId: id,
        name,
        amountMinor: parseMinorUnits(product.price_amount ?? product.amount),
        currency: normalizeCurrency(getString(product, "price_currency", "currency")),
        billingInterval: recurringInterval,
        intervalCount: normalizeIntervalCount(product.recurring_interval_count),
        active,
        lastSyncedAt: syncedAt,
      })
    }
  }

  for (const item of orders) {
    const order = asRecord(item)
    if (!order) continue
    const status = getString(order, "status")
    const paid = getBoolean(order, "paid") === true
    if (!paid && !["paid", "refunded", "partially_refunded"].includes(status ?? "")) continue
    if (!isWithinPeriod(getString(order, "created_at"), period.start, period.end)) continue

    metrics.addCharge({
      currency: getString(order, "currency", "currency_code"),
      grossMinor: parseMinorUnits(order.total_amount ?? order.subtotal_amount ?? order.amount),
      refundedMinor: parseMinorUnits(order.refunded_amount),
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const subscription = asRecord(item)
    if (!subscription || getString(subscription, "status") !== "active") continue
    const price = getRecord(subscription, "price")
    metrics.addActiveSubscription({
      currency: getString(subscription, "currency") ?? getString(price, "currency", "price_currency"),
      id: getString(subscription, "id"),
      amountMinor: parseMinorUnits(subscription.amount ?? price?.price_amount ?? price?.amount),
      interval: normalizeInterval(
        getString(subscription, "recurring_interval") ?? getString(price, "recurring_interval", "interval"),
      ),
      intervalCount: normalizeIntervalCount(
        subscription.recurring_interval_count ?? price?.recurring_interval_count ?? price?.interval_count,
      ),
      quantity: normalizeIntervalCount(subscription.quantity),
    })
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
