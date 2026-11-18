import { createPrivateKey, sign as signBytes } from "node:crypto"
import { gunzipSync } from "node:zlib"
import {
  appendCatalogItem,
  asRecord,
  finishProviderSync,
  ProviderApiError,
  ProviderAuthenticationError,
  ProviderSyncLimitError,
  requestBuffer,
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

const APP_STORE_API = "https://api.appstoreconnect.apple.com/v1/salesReports"
const MAX_REPORT_DAYS = 30
const REPORT_CONCURRENCY = 5

type SalesRow = Record<string, string>

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function createAppleToken(credentials: ProviderCredentials) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: credentials.keyId, typ: "JWT" }))
  const payload = base64Url(JSON.stringify({
    iss: credentials.issuerId,
    iat: now,
    exp: now + 15 * 60,
    aud: "appstoreconnect-v1",
  }))
  const unsigned = `${header}.${payload}`

  try {
    const privateKey = createPrivateKey(credentials.privateKey)
    const signature = signBytes("sha256", Buffer.from(unsigned), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url")
    return `${unsigned}.${signature}`
  } catch {
    throw new ProviderAuthenticationError()
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

function splitTsvLine(line: string) {
  return line.split("\t").map((value) => value.trim())
}

function parseSalesReport(text: string): SalesRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = splitTsvLine(lines[0]).map((header) => header.toLowerCase())

  return lines.slice(1).map((line) => {
    const values = splitTsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  })
}

function rowValue(row: SalesRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key.toLowerCase()]
    if (value) return value
  }
  return null
}

function reportDates(periodStart: string, days: number) {
  const start = new Date(`${periodStart}T00:00:00.000Z`)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
  })
}

async function fetchSalesReport(
  reportDate: string,
  vendorNumber: string,
  token: string,
) {
  const url = new URL(APP_STORE_API)
  url.searchParams.set("filter[vendorNumber]", vendorNumber)
  url.searchParams.set("filter[reportType]", "SUBSCRIPTION")
  url.searchParams.set("filter[reportSubType]", "SUMMARY")
  url.searchParams.set("filter[frequency]", "DAILY")
  url.searchParams.set("filter[reportDate]", reportDate)
  url.searchParams.set("filter[version]", "1_3")

  try {
    const compressed = await requestBuffer(url.toString(), {
      Authorization: `Bearer ${token}`,
      Accept: "application/a-gzip, application/octet-stream",
    })
    const decoded = compressed.length >= 2 && compressed[0] === 0x1f && compressed[1] === 0x8b
      ? gunzipSync(compressed)
      : compressed
    return parseSalesReport(decoded.toString("utf8"))
  } catch (error) {
    if (error instanceof ProviderApiError && error.status === 404) return []
    throw error
  }
}

export async function syncAppStoreConnect(credentials: ProviderCredentials): Promise<ProviderSyncResult> {
  if (!/^\d{1,16}$/.test(credentials.vendorNumber)) throw new ProviderAuthenticationError()
  const token = createAppleToken(credentials)
  const period = createPeriod(MAX_REPORT_DAYS - 1)
  const dates = reportDates(period.startDate, MAX_REPORT_DAYS)
  const reports = await mapWithConcurrency(
    dates,
    REPORT_CONCURRENCY,
    (date) => fetchSalesReport(date, credentials.vendorNumber, token),
  )

  const metrics = createCurrencyMetrics()
  const catalogItems: ProviderCatalogRecord[] = []
  const catalogIds = new Set<string>()
  const syncedAt = new Date()

  for (const rows of reports) {
    for (const row of rows) {
      const currency = normalizeCurrency(rowValue(row, "currency of proceeds", "customer currency", "currency"))
      if (!currency) continue

      const rawUnits = Number(rowValue(row, "units", "quantity") ?? "0")
      const units = Number.isSafeInteger(rawUnits) ? rawUnits : 0
      if (units === 0) continue
      const unitAmount = parseMajorUnits(
        rowValue(row, "developer proceeds", "proceeds", "customer price") ?? "0",
        currency,
      )
      if (unitAmount === null) continue

      const amount = unitAmount * BigInt(Math.abs(units || 1))
      const isRefund = units < 0 || unitAmount < 0n
      metrics.addAggregate({
        currency,
        grossMinor: isRefund ? null : amount,
        refundedMinor: isRefund ? (amount < 0n ? -amount : amount) : null,
        chargeCount: isRefund ? 0 : Math.max(0, units),
      })

      const sku = rowValue(row, "sku", "developer product id", "apple identifier")
      const title = rowValue(row, "title", "product name", "app name")
      if (sku && !catalogIds.has(sku)) {
        catalogIds.add(sku)
        appendCatalogItem(catalogItems, {
          itemKind: "plan",
          externalId: sku,
          name: title || sku,
          amountMinor: unitAmount >= 0n ? unitAmount : null,
          currency,
          active: true,
          lastSyncedAt: syncedAt,
        })
      }
    }
  }

  if (catalogItems.length > 500) throw new ProviderSyncLimitError()
  return finishProviderSync(metrics, catalogItems, period, syncedAt)
}
