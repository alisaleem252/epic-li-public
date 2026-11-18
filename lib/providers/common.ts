import "server-only"

import {
  MAX_PROVIDER_RECORDS,
  createPeriod,
  createCurrencyMetrics,
  toCatalogRecord,
  type ProviderCatalogRecord,
  type ProviderSyncResult,
} from "./metrics"
import { recordProviderRawResponse } from "./raw-capture"

export class ProviderAuthenticationError extends Error {
  constructor() {
    super("Provider credentials were rejected")
    this.name = "ProviderAuthenticationError"
  }
}

export class ProviderApiError extends Error {
  constructor(readonly status: number) {
    super("Provider API request failed")
    this.name = "ProviderApiError"
  }
}

export class ProviderUnavailableError extends Error {
  constructor() {
    super("Provider data is temporarily unavailable")
    this.name = "ProviderUnavailableError"
  }
}

export class ProviderSyncLimitError extends Error {
  constructor() {
    super("Provider sync exceeded its safe record limit")
    this.name = "ProviderSyncLimitError"
  }
}

const REQUEST_TIMEOUT_MS = 8_000

async function requestResponse(url: string, init: RequestInit = {}) {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new ProviderUnavailableError()
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderAuthenticationError()
  }
  if (!response.ok) throw new ProviderApiError(response.status)
  return response
}

export async function requestJson(url: string, headers: HeadersInit) {
  const response = await requestResponse(url, { headers })
  if (response.status === 204) return null

  try {
    const body = await response.json() as unknown
    recordProviderRawResponse({
      format: "json",
      contentType: response.headers.get("content-type"),
      body,
    })
    return body
  } catch {
    throw new ProviderUnavailableError()
  }
}

export async function requestText(url: string, init: RequestInit = {}) {
  const response = await requestResponse(url, init)
  const body = await response.text()
  recordProviderRawResponse({
    format: "text",
    contentType: response.headers.get("content-type"),
    body,
  })
  return body
}

export async function requestBuffer(url: string, headers: HeadersInit) {
  const response = await requestResponse(url, { headers })
  const body = Buffer.from(await response.arrayBuffer())
  recordProviderRawResponse({
    format: "binary-base64",
    contentType: response.headers.get("content-type"),
    body: body.toString("base64"),
  })
  return body
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function extractItems(value: unknown): unknown[] {
  const record = asRecord(value)
  if (!record) return asArray(value)

  for (const key of ["items", "data", "results", "records", "rows"]) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
    const nested = asRecord(candidate)
    if (nested) {
      for (const nestedKey of ["items", "data", "results", "records", "rows"]) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[]
      }
    }
  }

  return []
}

export function attributes(value: unknown) {
  const record = asRecord(value)
  if (!record) return null
  return asRecord(record.attributes) ?? record
}

export function getString(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

export function getRecord(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = asRecord(record[key])
    if (value) return value
  }
  return null
}

export function getBoolean(record: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "boolean") return value
  }
  return null
}

export function getList(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return []
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[]
  }
  return []
}

export function jsonHeaders(token: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export async function collectJsonPages(
  firstUrl: string,
  headers: HeadersInit,
  getNextUrl: (payload: unknown, items: unknown[], page: number) => string | null,
  options: { maxRecords?: number; maxPages?: number } = {},
) {
  const maxRecords = options.maxRecords ?? MAX_PROVIDER_RECORDS
  const maxPages = options.maxPages ?? 24
  const allowedOrigin = new URL(firstUrl).origin
  const collected: unknown[] = []
  const seen = new Set<string>()
  let currentUrl = firstUrl

  for (let page = 0; page < maxPages; page += 1) {
    const requestUrl = new URL(currentUrl, firstUrl)
    if (requestUrl.origin !== allowedOrigin || seen.has(requestUrl.toString())) {
      throw new ProviderUnavailableError()
    }
    seen.add(requestUrl.toString())

    const payload = await requestJson(requestUrl.toString(), headers)
    const items = extractItems(payload)
    collected.push(...items)
    if (collected.length > maxRecords) throw new ProviderSyncLimitError()

    const nextUrl = getNextUrl(payload, items, page)
    if (!nextUrl) return collected

    const parsedNext = new URL(nextUrl, requestUrl)
    if (parsedNext.origin !== allowedOrigin) throw new ProviderUnavailableError()
    currentUrl = parsedNext.toString()
  }

  throw new ProviderSyncLimitError()
}

export function jsonEachRows(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed
    const items = extractItems(parsed)
    return items.length > 0 ? items : [parsed]
  } catch {
    const rows: unknown[] = []
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        rows.push(JSON.parse(line) as unknown)
      } catch {
        throw new ProviderUnavailableError()
      }
    }
    return rows
  }
}

export function appendCatalogItem(
  target: ProviderCatalogRecord[],
  input: Parameters<typeof toCatalogRecord>[0],
) {
  const item = toCatalogRecord(input)
  if (!item) return
  target.push(item)
  if (target.length > MAX_PROVIDER_RECORDS) throw new ProviderSyncLimitError()
}

export function finishProviderSync(
  metrics: ReturnType<typeof createCurrencyMetrics>,
  catalogItems: ProviderCatalogRecord[],
  period = createPeriod(),
  validatedAt = new Date(),
): ProviderSyncResult {
  return {
    snapshots: metrics.snapshots(period.startDate, period.endDate),
    catalogItems,
    validatedAt,
  }
}
