import {
  appendCatalogItem,
  asRecord,
  finishProviderSync,
  getString,
  jsonEachRows,
  ProviderAuthenticationError,
  ProviderUnavailableError,
  requestText,
} from "../common"
import {
  createCurrencyMetrics,
  createPeriod,
  normalizeCurrency,
  parseCount,
  parseMajorUnits,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "../metrics"
import type { ProviderCredentials } from "../credentials"

const SUPERWALL_API = "https://api.superwall.com/v2/organizations"
const MAX_APPLICATIONS = 100

async function runQuery(organizationId: string, apiKey: string, query: string) {
  const url = `${SUPERWALL_API}/${encodeURIComponent(organizationId)}/query`
  return requestText(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "text/plain; charset=utf-8",
      Accept: "application/json, text/plain",
    },
    body: query,
  })
}

function applicationIds(rows: unknown[]) {
  const ids = new Set<number>()
  for (const row of rows) {
    const record = asRecord(row)
    const value = record?.applicationId ?? record?.application_id
    const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
    if (Number.isSafeInteger(id) && id > 0) ids.add(id)
  }
  return [...ids].slice(0, MAX_APPLICATIONS)
}

export async function syncSuperwall(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  const organizationId = credentials.organizationId
  const apiKey = credentials.organizationApiKey
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) throw new ProviderAuthenticationError()

  const period = createPeriod()
  const appRows = jsonEachRows(await runQuery(
    organizationId,
    apiKey,
    "SELECT DISTINCT applicationId FROM open_revenue.attributed_events_by_ts_rep FINAL WHERE ts >= now() - INTERVAL 30 DAY AND isSandbox = 0 LIMIT 100 FORMAT JSONEachRow",
  ))
  const ids = applicationIds(appRows)
  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const syncedAt = new Date()

  if (ids.length === 0) return finishProviderSync(metrics, catalogItems, period, syncedAt)

  const idList = ids.join(",")
  const revenueQuery = `SELECT currencyCode, sum(price) AS gross_amount, count() AS event_count FROM open_revenue.attributed_events_by_ts_rep FINAL WHERE applicationId IN (${idList}) AND isSandbox = 0 AND ts >= now() - INTERVAL 30 DAY GROUP BY currencyCode FORMAT JSONEachRow`
  const catalogQuery = `SELECT productId, any(productId) AS product_name FROM open_revenue.attributed_events_by_ts_rep FINAL WHERE applicationId IN (${idList}) AND isSandbox = 0 AND ts >= now() - INTERVAL 365 DAY AND productId IS NOT NULL GROUP BY productId ORDER BY productId LIMIT 100 FORMAT JSONEachRow`
  const [revenueRows, productRows] = await Promise.all([
    runQuery(organizationId, apiKey, revenueQuery).then(jsonEachRows),
    runQuery(organizationId, apiKey, catalogQuery).then(jsonEachRows),
  ])

  for (const row of revenueRows) {
    const record = asRecord(row)
    if (!record) continue
    const currency = normalizeCurrency(getString(record, "currencyCode", "currency_code"))
    const gross = parseMajorUnits(record.gross_amount ?? record.grossAmount ?? record.price, currency ?? "usd")
    if (!currency || gross === null) continue
    metrics.addAggregate({
      currency,
      grossMinor: gross,
      chargeCount: parseCount(record.event_count ?? record.count),
    })
  }

  for (const row of productRows) {
    const record = asRecord(row)
    const productId = getString(record, "productId", "product_id")
    if (!productId) continue
    appendCatalogItem(catalogItems, {
      itemKind: "product",
      externalId: productId,
      name: getString(record, "product_name") || productId,
      active: true,
      lastSyncedAt: syncedAt,
    })
  }

  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
