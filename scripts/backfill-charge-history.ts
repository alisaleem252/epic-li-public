/**
 * One-off, idempotent backfill for profiles created before dated charge
 * history existed. Run after applying db/migrations/001_profile_charge_events.sql:
 *
 *   pnpm dlx tsx scripts/backfill-charge-history.ts
 *
 * Reads DATABASE_URL and EPICLI_KEY_ENCRYPTION_KEY from .env.local (or the
 * process environment). Decrypts each stored Stripe restricted key in memory,
 * fetches up to MAX_STORED_CHARGES newest charges, and inserts minimal events.
 */
import { createDecipheriv, createHmac, hkdfSync } from "node:crypto"
import { Pool } from "pg"
import Stripe from "stripe"
import { MAX_STORED_CHARGES } from "../lib/charge-trajectories"

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const ASSOCIATED_DATA = Buffer.from("epic-li:stripe-key:v1", "utf8")
const INSERT_BATCH_SIZE = 500

function getMasterKey() {
  const value = process.env.EPICLI_KEY_ENCRYPTION_KEY?.trim()
  if (!value) throw new Error("EPICLI_KEY_ENCRYPTION_KEY is not configured")
  if (/^[a-fA-F0-9]{64}$/.test(value)) return Buffer.from(value, "hex")

  const decoded = Buffer.from(value, "base64")
  if (decoded.length === 32 && decoded.toString("base64") === value) return decoded
  throw new Error("EPICLI_KEY_ENCRYPTION_KEY must encode exactly 32 random bytes")
}

function deriveProjectKey(purpose: string) {
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

function decryptStripeKey(encryptedKey: string, encryptionIv: string, encryptionVersion: number) {
  if (encryptionVersion !== 1) throw new Error("Unsupported Stripe key encryption version")

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

function hashCustomerId(customerId: string) {
  return createHmac("sha256", deriveProjectKey("customer-id-hash:stripe:v1"))
    .update(customerId, "utf8")
    .digest("hex")
}

function customerIdOf(charge: Stripe.Charge) {
  if (!charge.customer) return null
  return typeof charge.customer === "string" ? charge.customer : charge.customer.id
}

function isRecurringCharge(charge: Stripe.Charge) {
  return /subscription/i.test(charge.description ?? "")
}

type ChargeEvent = {
  chargeId: string
  occurredAt: Date
  currency: string
  amountCapturedMinor: string
  isRecurring: boolean
  customerHash: string | null
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  const client = await pool.connect()
  let totalEvents = 0

  try {
    const profiles = await client.query<{
      profile_id: string
      encrypted_key: string
      encryption_iv: string
      encryption_version: number
    }>(`
      select p.id as profile_id,
             c.encrypted_key,
             c.encryption_iv,
             c.encryption_version
      from public.profiles p
      join public.stripe_connections c on c.profile_id = p.id
      where p.status = 'published'
    `)

    for (const profile of profiles.rows) {
      let events: ChargeEvent[] = []

      try {
        const restrictedKey = decryptStripeKey(
          profile.encrypted_key,
          profile.encryption_iv,
          Number(profile.encryption_version),
        )
        const stripe = new Stripe(restrictedKey, {
          apiVersion: "2026-09-30.endive",
          maxNetworkRetries: 0,
          timeout: 8_000,
        })
        const charges: Stripe.Charge[] = []

        for await (const charge of stripe.charges.list({ limit: 100 })) {
          if (charges.length >= MAX_STORED_CHARGES) break
          charges.push(charge)
        }

        events = charges.flatMap((charge) => {
          if (charge.status !== "succeeded" || !charge.paid || !charge.captured) return []

          const customerId = customerIdOf(charge)
          return [{
            chargeId: charge.id,
            occurredAt: new Date(charge.created * 1000),
            currency: charge.currency.toLowerCase(),
            amountCapturedMinor: BigInt(charge.amount_captured ?? charge.amount).toString(),
            isRecurring: isRecurringCharge(charge),
            customerHash: customerId ? hashCustomerId(customerId) : null,
          }]
        })
      } catch {
        console.warn(`Skipped profile ${profile.profile_id}: key or Stripe read failed`)
        continue
      }

      await client.query("BEGIN")
      try {
        for (let index = 0; index < events.length; index += INSERT_BATCH_SIZE) {
          const batch = events.slice(index, index + INSERT_BATCH_SIZE)
          const values: unknown[] = []
          const placeholders = batch.map((event, rowIndex) => {
            const offset = rowIndex * 7
            values.push(
              profile.profile_id,
              event.chargeId,
              event.occurredAt,
              event.currency,
              event.amountCapturedMinor,
              event.isRecurring,
              event.customerHash,
            )
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
          })

          await client.query(
            `insert into public.profile_charge_events
               (profile_id, charge_id, occurred_at, currency, amount_captured_minor, is_recurring, customer_hash)
             values ${placeholders.join(", ")}
             on conflict (profile_id, charge_id) do nothing`,
            values,
          )
        }
        await client.query("COMMIT")
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {})
        throw error
      }

      totalEvents += events.length
      console.log(`Backfilled ${events.length} charge events for profile ${profile.profile_id}`)
    }

    console.log(`Done: ${totalEvents} charge events across ${profiles.rows.length} Stripe profiles.`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed")
  process.exitCode = 1
})
