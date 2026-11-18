import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import { gunzipSync, gzipSync } from "node:zlib"

const ENCRYPTION_VERSION = 1 as const
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const ASSOCIATED_DATA = Buffer.from("epic-li:stripe-key:v1", "utf8")

function getMasterKey() {
  const value = process.env.EPICLI_KEY_ENCRYPTION_KEY?.trim()
  if (!value) throw new Error("EPICLI_KEY_ENCRYPTION_KEY is not configured")
  if (/^[a-fA-F0-9]{64}$/.test(value)) return Buffer.from(value, "hex")

  const decoded = Buffer.from(value, "base64")
  if (decoded.length === 32 && decoded.toString("base64") === value) return decoded
  throw new Error("EPICLI_KEY_ENCRYPTION_KEY must encode exactly 32 random bytes")
}

export function isKeyEncryptionConfigured() {
  try {
    getMasterKey()
    return true
  } catch {
    return false
  }
}

export function deriveProjectKey(purpose: string) {
  return Buffer.from(
    hkdfSync(
      "sha256",
      getMasterKey(),
      Buffer.from("epic-li:key-derivation:v1", "utf8"),
      Buffer.from(purpose, "utf8"),
      32,
    ),
  )
}

export function encryptStripeKey(plaintext: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", deriveProjectKey("stripe-api-key:v1"), iv)
  cipher.setAAD(ASSOCIATED_DATA)

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authenticatedCiphertext = Buffer.concat([ciphertext, cipher.getAuthTag()])

  return {
    encryptedKey: authenticatedCiphertext.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionVersion: ENCRYPTION_VERSION,
  }
}

export function decryptStripeKey(
  encryptedKey: string,
  encryptionIv: string,
  encryptionVersion: number,
) {
  if (encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported Stripe key encryption version")
  }

  const iv = Buffer.from(encryptionIv, "base64")
  const encrypted = Buffer.from(encryptedKey, "base64")
  if (iv.length !== IV_LENGTH || encrypted.length <= AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted Stripe key payload")
  }

  const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH)
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv("aes-256-gcm", deriveProjectKey("stripe-api-key:v1"), iv)
  decipher.setAAD(ASSOCIATED_DATA)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

export function matchesEncryptedStripeKey(
  candidate: string,
  encryptedKey: string,
  encryptionIv: string,
  encryptionVersion: number,
) {
  try {
    const storedKey = decryptStripeKey(encryptedKey, encryptionIv, encryptionVersion)
    const candidateDigest = createHash("sha256").update(candidate, "utf8").digest()
    const storedDigest = createHash("sha256").update(storedKey, "utf8").digest()
    return timingSafeEqual(candidateDigest, storedDigest)
  } catch {
    return false
  }
}

function providerAssociatedData(providerId: string) {
  if (!/^[a-z0-9_]+$/.test(providerId)) throw new Error("Invalid provider identifier")
  return Buffer.from(`epic-li:provider-credentials:${providerId}:v1`, "utf8")
}

function canonicalJson(value: Record<string, string>) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  )
}

export function encryptProviderCredentials(providerId: string, plaintext: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveProjectKey(`provider-credentials:${providerId}:v1`),
    iv,
  )
  cipher.setAAD(providerAssociatedData(providerId))

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authenticatedCiphertext = Buffer.concat([ciphertext, cipher.getAuthTag()])

  return {
    encryptedCredentials: authenticatedCiphertext.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionVersion: ENCRYPTION_VERSION,
  }
}

export function decryptProviderCredentials(
  providerId: string,
  encryptedCredentials: string,
  encryptionIv: string,
  encryptionVersion: number,
) {
  if (encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error("Unsupported provider credential encryption version")
  }

  const iv = Buffer.from(encryptionIv, "base64")
  const encrypted = Buffer.from(encryptedCredentials, "base64")
  if (iv.length !== IV_LENGTH || encrypted.length <= AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted provider credential payload")
  }

  const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH)
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveProjectKey(`provider-credentials:${providerId}:v1`),
    iv,
  )
  decipher.setAAD(providerAssociatedData(providerId))
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

export function hashProviderCustomerId(providerId: string, customerId: string) {
  if (!/^[a-z0-9_]+$/.test(providerId)) throw new Error("Invalid provider identifier")
  return createHmac("sha256", deriveProjectKey(`customer-id-hash:${providerId}:v1`))
    .update(customerId, "utf8")
    .digest("hex")
}

const PROVIDER_PAYLOAD_ENCRYPTION_VERSION = 1 as const

function providerPayloadAssociatedData(providerId: string) {
  if (!/^[a-z0-9_]+$/.test(providerId)) throw new Error("Invalid provider identifier")
  return Buffer.from(`epic-li:provider-payload:${providerId}:gzip:v1`, "utf8")
}

export function encryptProviderPayload(providerId: string, payload: unknown) {
  const serialized = JSON.stringify(payload)
  if (typeof serialized !== "string") throw new Error("Provider payload is not serializable")

  const compressed = gzipSync(Buffer.from(serialized, "utf8"))
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveProjectKey(`provider-payload:${providerId}:gzip:v1`),
    iv,
  )
  cipher.setAAD(providerPayloadAssociatedData(providerId))

  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()])
  const authenticatedCiphertext = Buffer.concat([ciphertext, cipher.getAuthTag()])

  return {
    encryptedPayload: authenticatedCiphertext.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionVersion: PROVIDER_PAYLOAD_ENCRYPTION_VERSION,
  }
}

export function decryptProviderPayload(
  providerId: string,
  encryptedPayload: string,
  encryptionIv: string,
  encryptionVersion: number,
) {
  if (encryptionVersion !== PROVIDER_PAYLOAD_ENCRYPTION_VERSION) {
    throw new Error("Unsupported provider payload encryption version")
  }

  const iv = Buffer.from(encryptionIv, "base64")
  const encrypted = Buffer.from(encryptedPayload, "base64")
  if (iv.length !== IV_LENGTH || encrypted.length <= AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted provider payload")
  }

  const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH)
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveProjectKey(`provider-payload:${providerId}:gzip:v1`),
    iv,
  )
  decipher.setAAD(providerPayloadAssociatedData(providerId))
  decipher.setAuthTag(authTag)

  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(gunzipSync(compressed).toString("utf8")) as unknown
}

export function matchesEncryptedProviderCredentialProof(
  providerId: string,
  proof: Record<string, string>,
  encryptedCredentials: string,
  encryptionIv: string,
  encryptionVersion: number,
) {
  try {
    const stored = JSON.parse(
      decryptProviderCredentials(providerId, encryptedCredentials, encryptionIv, encryptionVersion),
    ) as unknown
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return false

    const storedRecord = stored as Record<string, unknown>
    const proofKeys = Object.keys(proof).sort()
    if (proofKeys.length === 0 || proofKeys.some((key) => typeof storedRecord[key] !== "string")) {
      return false
    }

    const storedProof = Object.fromEntries(proofKeys.map((key) => [key, storedRecord[key] as string]))
    const candidateDigest = createHash("sha256").update(canonicalJson(proof), "utf8").digest()
    const storedDigest = createHash("sha256").update(canonicalJson(storedProof), "utf8").digest()
    return timingSafeEqual(candidateDigest, storedDigest)
  } catch {
    return false
  }
}
