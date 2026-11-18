import {
  getProviderDefinition,
  type ProviderCredentialField,
  type RevenueProviderId,
} from "./registry"

export type ProviderCredentials = Record<string, string>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeValue(field: ProviderCredentialField, value: string) {
  const normalized = field.inputType === "textarea"
    ? value.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim()
    : value.trim()

  if (normalized.length > field.maxLength) return null
  if (field.inputType !== "textarea" && /[\u0000-\u001f\u007f]/.test(normalized)) return null
  return normalized
}

export function parseProviderCredentials(
  providerId: RevenueProviderId,
  value: unknown,
): ProviderCredentials | null {
  if (!isRecord(value)) return null

  const fields = getProviderDefinition(providerId).fields
  const fieldMap = new Map(fields.map((field) => [field.key, field]))
  if (Object.keys(value).some((key) => !fieldMap.has(key))) return null

  const credentials: ProviderCredentials = {}
  for (const field of fields) {
    const raw = value[field.key]
    if (raw === undefined && field.optional) {
      credentials[field.key] = ""
      continue
    }
    if (typeof raw !== "string") return null

    const normalized = normalizeValue(field, raw)
    if (normalized === null || (!field.optional && !normalized)) return null
    credentials[field.key] = normalized
  }

  return credentials
}

export function parseProviderCredentialProof(
  providerId: RevenueProviderId,
  value: unknown,
): ProviderCredentials | null {
  if (!isRecord(value)) return null

  const secretFields = getProviderDefinition(providerId).fields.filter((field) => field.secret)
  if (Object.keys(value).some((key) => !secretFields.some((field) => field.key === key))) return null

  const proof: ProviderCredentials = {}
  for (const field of secretFields) {
    const raw = value[field.key]
    if (typeof raw !== "string") return null
    const normalized = normalizeValue(field, raw)
    if (normalized === null || !normalized) return null
    proof[field.key] = normalized
  }

  return proof
}

export function serializeProviderCredentials(credentials: ProviderCredentials) {
  const canonical = Object.fromEntries(
    Object.entries(credentials).sort(([left], [right]) => left.localeCompare(right)),
  )
  return JSON.stringify(canonical)
}
