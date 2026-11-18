import {
  appendCatalogItem,
  asRecord,
  attributes,
  collectJsonPages,
  finishProviderSync,
  getRecord,
  getString,
  jsonHeaders,
  ProviderUnavailableError,
  requestJson,
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

const LEMON_API = "https://api.lemonsqueezy.com/v1"
const PAGE_SIZE = 100

function lemonHeaders(apiKey: string) {
  return {
    ...jsonHeaders(apiKey),
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
  }
}

function lemonNextUrl(payload: unknown, page: number, path: string, storeId?: string) {
  const root = asRecord(payload)
  const links = getRecord(root, "links")
  const next = getString(links, "next")
  if (next) return next

  const meta = getRecord(root, "meta")
  const pageMeta = getRecord(meta, "page")
  const lastPage = parseCount(pageMeta?.lastPage ?? pageMeta?.last_page)
  if (lastPage > page + 1) {
    const url = new URL(`${LEMON_API}/${path}`)
    url.searchParams.set("page[number]", String(page + 2))
    url.searchParams.set("page[size]", String(PAGE_SIZE))
    if (storeId) url.searchParams.set("filter[store_id]", storeId)
    return url.toString()
  }
  return null
}

async function listLemonResource(
  path: string,
  storeId: string | undefined,
  apiKey: string,
) {
  const url = new URL(`${LEMON_API}/${path}`)
  url.searchParams.set("page[number]", "1")
  url.searchParams.set("page[size]", String(PAGE_SIZE))
  if (storeId) url.searchParams.set("filter[store_id]", storeId)

  return collectJsonPages(
    url.toString(),
    lemonHeaders(apiKey),
    (payload, items, page) => {
      const next = lemonNextUrl(payload, page, path, storeId)
      if (next) return next
      return items.length === PAGE_SIZE
        ? lemonNextUrl({ links: {}, meta: { page: { lastPage: page + 2 } } }, page, path, storeId)
        : null
    },
  )
}

function isWithinPeriod(value: string | null, start: Date, end: Date) {
  if (!value) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date >= start && date <= end
}

export async function syncLemonSqueezy(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const apiKey = credentials.apiKey
  const storesUrl = new URL(`${LEMON_API}/stores`)
  storesUrl.searchParams.set("page[number]", "1")
  storesUrl.searchParams.set("page[size]", "100")
  const stores = await collectJsonPages(
    storesUrl.toString(),
    lemonHeaders(apiKey),
    (payload, items, page) => lemonNextUrl(payload, page, "stores") ??
      (items.length === PAGE_SIZE ? `${LEMON_API}/stores?page%5Bnumber%5D=${page + 2}&page%5Bsize%5D=${PAGE_SIZE}` : null),
    { maxRecords: 100, maxPages: 2 },
  )

  const selectedStoreId = credentials.storeId || null
  const store = stores.find((item) => {
    const record = asRecord(item)
    return !selectedStoreId || getString(record, "id") === selectedStoreId
  })
  const storeAttributes = attributes(store)
  const storeId = getString(asRecord(store), "id")
  const storeCurrency = normalizeCurrency(getString(storeAttributes, "currency"))
  if (!store || !storeId || !storeCurrency) throw new ProviderUnavailableError()

  const [products, variants, orders, subscriptions] = await Promise.all([
    listLemonResource("products", storeId, apiKey),
    listLemonResource("variants", storeId, apiKey),
    listLemonResource("orders", storeId, apiKey),
    listLemonResource("subscriptions", storeId, apiKey),
  ])

  const period = createPeriod()
  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const productNames = new Map<string, string>()
  const variantsById = new Map<string, Record<string, unknown>>()
  const syncedAt = new Date()

  for (const item of products) {
    const record = asRecord(item)
    const data = attributes(item)
    const id = getString(record, "id")
    const name = getString(data, "name")
    if (!id || !name) continue
    productNames.set(id, name)
    const status = getString(data, "status")
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name,
      active: status === "published" || status === "active",
      lastSyncedAt: syncedAt,
    })
  }

  for (const item of variants) {
    const record = asRecord(item)
    const data = attributes(item)
    const id = getString(record, "id")
    const productId = getString(data, "product_id")
    if (id) variantsById.set(id, data ?? {})
    if (!id || !productId) continue

    const isSubscription = data?.is_subscription === true || data?.is_subscription === "true"
    if (!isSubscription) continue

    const interval = normalizeInterval(getString(data, "interval"))
    const amountMinor = parseMinorUnits(data?.price)
    const productName = productNames.get(productId)
    const variantName = getString(data, "name")
    appendCatalogItem(catalogItems, {
      itemKind: "plan",
      externalId: id,
      productExternalId: productId,
      name: variantName || productName || "Subscription plan",
      amountMinor,
      currency: storeCurrency,
      billingInterval: interval,
      intervalCount: normalizeIntervalCount(data?.interval_count),
      active: getString(data, "status") === "published",
      lastSyncedAt: syncedAt,
    })
  }

  for (const item of orders) {
    const data = attributes(item)
    const createdAt = getString(data, "created_at")
    const status = getString(data, "status")
    const currency = normalizeCurrency(getString(data, "currency"))
    if (
      data?.test_mode === true ||
      !isWithinPeriod(createdAt, period.start, period.end) ||
      !["paid", "refunded", "partial_refund"].includes(status ?? "") ||
      !currency
    ) continue

    const refunded = parseMinorUnits(data?.refunded_amount) ?? 0n
    metrics.addCharge({
      currency,
      grossMinor: parseMinorUnits(data?.total),
      refundedMinor: refunded,
      count: 1,
    })
  }

  for (const item of subscriptions) {
    const record = asRecord(item)
    const data = attributes(item)
    if (getString(data, "status") !== "active") continue

    const id = getString(record, "id")
    const variantId = getString(data, "variant_id")
    const variant = variantId ? variantsById.get(variantId) : null
    const interval = normalizeInterval(getString(variant, "interval"))
    const amountMinor = parseMinorUnits(variant?.price)
    metrics.addActiveSubscription({
      currency: storeCurrency,
      id,
      amountMinor,
      interval,
      intervalCount: normalizeIntervalCount(variant?.interval_count),
      quantity: 1,
    })
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
