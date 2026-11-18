import {
  appendCatalogItem,
  asRecord,
  collectJsonPages,
  finishProviderSync,
  getList,
  getRecord,
  getString,
  jsonHeaders,
  requestJson,
  ProviderUnavailableError,
} from "../common"
import {
  createCurrencyMetrics,
  createPeriod,
  normalizeInterval,
  normalizeIntervalCount,
  parseCount,
  parseMajorUnits,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const REVENUECAT_API = "https://api.revenuecat.com/v2"
const PAGE_SIZE = 100

function revenueCatNextUrl(payload: unknown, items: unknown[], page: number, path: string, projectId?: string) {
  const root = asRecord(payload)
  const nextPage = getString(root, "next_page")
  if (nextPage) return nextPage
  if (items.length === PAGE_SIZE) {
    const last = asRecord(items[items.length - 1])
    const id = getString(last, "id")
    if (!id) return null
    const url = new URL(`${REVENUECAT_API}/${path}`)
    url.searchParams.set("limit", String(PAGE_SIZE))
    url.searchParams.set("starting_after", id)
    if (projectId) url.pathname = `${url.pathname.replace(/\/$/, "")}`
    return url.toString()
  }
  return null
}

async function listRevenueCat(path: string, apiKey: string, projectId?: string) {
  const url = new URL(`${REVENUECAT_API}/${path}`)
  url.searchParams.set("limit", String(PAGE_SIZE))
  return collectJsonPages(
    url.toString(),
    jsonHeaders(apiKey),
    (payload, items, page) => revenueCatNextUrl(payload, items, page, path, projectId),
  )
}

function readMetricNumber(value: unknown, depth = 0): number | null {
  if (depth > 6) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const result = readMetricNumber(value[index], depth + 1)
      if (result !== null) return result
    }
    return null
  }

  const record = asRecord(value)
  if (!record) return null
  for (const key of ["value", "total", "mrr", "actives", "active_subscriptions", "revenue", "count"]) {
    const candidate = record[key]
    if (typeof candidate === "number" || typeof candidate === "string") {
      const result = readMetricNumber(candidate, depth + 1)
      if (result !== null) return result
    }
  }
  for (const key of ["summary", "values", "data", "items", "chart", "result"]) {
    const result = readMetricNumber(record[key], depth + 1)
    if (result !== null) return result
  }
  return null
}

function durationInterval(value: unknown) {
  if (typeof value !== "string") return null
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:(\d+)M)?(?:(\d+)Y)?$/i.exec(value)
  if (!match) return null
  if (match[1]) return { interval: "week" as const, count: Number(match[1]) }
  if (match[2]) return { interval: "day" as const, count: Number(match[2]) }
  if (match[3]) return { interval: "month" as const, count: Number(match[3]) }
  if (match[4]) return { interval: "year" as const, count: Number(match[4]) }
  return null
}

export async function syncRevenueCat(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const apiKey = credentials.apiKey
  const headers = jsonHeaders(apiKey)
  let projectId = credentials.projectId || ""

  if (!projectId) {
    const projects = await listRevenueCat("projects", apiKey)
    const firstProject = asRecord(projects[0])
    projectId = getString(firstProject, "id", "project_id") ?? ""
  }
  if (!projectId) throw new ProviderUnavailableError()

  const encodedProjectId = encodeURIComponent(projectId)
  const period = createPeriod()
  const productsPath = `projects/${encodedProjectId}/products`
  const productsUrl = new URL(`${REVENUECAT_API}/${productsPath}`)
  productsUrl.searchParams.set("limit", String(PAGE_SIZE))
  const products = await collectJsonPages(
    productsUrl.toString(),
    headers,
    (payload, items, page) => revenueCatNextUrl(payload, items, page, productsPath, projectId),
  )

  const metricUrl = (path: string) => {
    const url = new URL(`${REVENUECAT_API}/projects/${encodedProjectId}/${path}`)
    url.searchParams.set("start_date", period.startDate)
    url.searchParams.set("end_date", period.endDate)
    if (path.startsWith("metrics/")) url.searchParams.set("currency", "USD")
    return url.toString()
  }

  const [revenueResponse, mrrResponse, activesResponse] = await Promise.all([
    requestJson(metricUrl("metrics/revenue"), headers),
    requestJson(metricUrl("charts/mrr"), headers),
    requestJson(metricUrl("charts/actives"), headers),
  ])

  const revenueMajor = readMetricNumber(revenueResponse)
  const mrrMajor = readMetricNumber(mrrResponse)
  const activeCount = readMetricNumber(activesResponse)
  const metrics = createCurrencyMetrics()
  metrics.addAggregate({
    currency: "usd",
    grossMinor: revenueMajor === null ? null : parseMajorUnits(revenueMajor, "usd"),
    activeSubscriptionCount: activeCount === null ? 0 : parseCount(activeCount),
    mrrMinor: mrrMajor === null ? null : parseMajorUnits(mrrMajor, "usd"),
  })

  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()
  for (const item of products) {
    const product = asRecord(item)
    if (!product) continue
    const id = getString(product, "id")
    const storeIdentifier = getString(product, "store_identifier", "name")
    if (!id || !storeIdentifier) continue

    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: id,
      name: storeIdentifier,
      active: true,
      lastSyncedAt: syncedAt,
    })

    const subscription = getRecord(product, "subscription")
    const duration = durationInterval(subscription?.duration)
    if (getString(product, "type") === "subscription" || duration) {
      appendCatalogItem(catalogItems, {
        itemKind: "plan",
        externalId: id,
        productExternalId: id,
        name: storeIdentifier,
        amountMinor: null,
        currency: "usd",
        billingInterval: duration?.interval ?? normalizeInterval(getString(subscription, "duration")),
        intervalCount: normalizeIntervalCount(duration?.count),
        active: true,
        lastSyncedAt: syncedAt,
      })
    }
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
