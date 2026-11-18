import { ipAddress } from "@vercel/functions"
import { and, eq, notInArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  paymentProviderCatalogItems,
  paymentProviderConnections,
  profileChargeEvents,
  profiles,
  providerPayloadSnapshots,
  revenueSnapshots,
  stripeConnections,
  stripePlans,
  stripeProducts,
} from "@/lib/db/schema"
import { verifyProfileCredentialProof } from "@/lib/profile-credential-proof"
import {
  ProviderApiError,
  ProviderAuthenticationError,
  ProviderSyncLimitError,
  ProviderUnavailableError,
} from "@/lib/providers/common"
import { parseProviderCredentials } from "@/lib/providers/credentials"
import { isRevenueProviderId } from "@/lib/providers/registry"
import { syncRevenueProvider } from "@/lib/providers/sync"
import { limitProfileResync } from "@/lib/security/rate-limit"
import { createStripeClient } from "@/lib/stripe/client"
import {
  decryptProviderCredentials,
  decryptStripeKey,
  encryptProviderPayload,
  isKeyEncryptionConfigured,
} from "@/lib/stripe/crypto"
import { StripeSyncLimitError, syncInitialStripeData } from "@/lib/stripe/sync"
import { normalizeHandle } from "@/lib/profiles"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_REQUEST_BYTES = 24_576
const CHARGE_EVENT_INSERT_BATCH = 500

type RouteContext = {
  params: Promise<{ handle: string }>
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function providerSyncFailure(error: unknown) {
  if (error instanceof ProviderAuthenticationError) {
    return { status: 422, error: "provider_auth_failed", message: "The provider rejected the stored credentials." }
  }
  if (error instanceof ProviderSyncLimitError) {
    return { status: 422, error: "sync_limit_exceeded", message: "The provider sync exceeded the safe record limit." }
  }
  if (error instanceof ProviderApiError && [400, 422].includes(error.status)) {
    return { status: 422, error: "provider_request_invalid", message: "The provider rejected the request." }
  }
  if (error instanceof ProviderUnavailableError || error instanceof ProviderApiError) {
    return { status: 502, error: "provider_unavailable", message: "The provider could not complete the sync." }
  }
  return null
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  let rateLimit: Awaited<ReturnType<typeof limitProfileResync>>
  try {
    rateLimit = await limitProfileResync(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      { error: "rate_limit_unavailable", message: "Secure data resync is temporarily unavailable." },
      503,
    )
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterSeconds,
        message: "Too many data resync attempts.",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfterSeconds),
        },
      },
    )
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "invalid_content_type", message: "Send a JSON request." }, 415)
  }

  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "request_too_large", message: "The request is too large." }, 413)
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return jsonResponse({ error: "invalid_request", message: "The request could not be read." }, 400)
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "request_too_large", message: "The request is too large." }, 413)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: "invalid_json", message: "Send a valid JSON request." }, 400)
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: "invalid_request", message: "The request fields are invalid." }, 400)
  }

  const { handle: rawHandle } = await params
  const currentHandle = normalizeHandle(rawHandle)
  const stripeRestrictedKey = typeof body.stripeRestrictedKey === "string"
    ? body.stripeRestrictedKey.trim()
    : ""
  const requestedProviderId = isRevenueProviderId(body.providerId) ? body.providerId : null

  if (!currentHandle) {
    return jsonResponse({ error: "profile_not_found", message: "That public profile was not found." }, 404)
  }
  if (!isKeyEncryptionConfigured()) {
    return jsonResponse(
      { error: "encryption_unavailable", message: "Secure data resync is temporarily unavailable." },
      503,
    )
  }

  try {
    const [profile] = await db
      .select({ id: profiles.id, handle: profiles.handle })
      .from(profiles)
      .where(and(eq(profiles.handle, currentHandle), eq(profiles.status, "published")))
      .limit(1)

    if (!profile) {
      return jsonResponse({ error: "profile_not_found", message: "That public profile was not found." }, 404)
    }

    const credentialProof = await verifyProfileCredentialProof(profile.id, {
      requestedProviderId,
      stripeRestrictedKey,
      credentials: body.credentials,
    })
    if (!credentialProof.ok) {
      return jsonResponse(
        { error: credentialProof.error, message: credentialProof.message },
        credentialProof.status,
      )
    }

    const now = new Date()

    if (credentialProof.providerId === "stripe") {
      const [stripeConnection] = await db
        .select({
          encryptedKey: stripeConnections.encryptedKey,
          encryptionIv: stripeConnections.encryptionIv,
          encryptionVersion: stripeConnections.encryptionVersion,
        })
        .from(stripeConnections)
        .where(eq(stripeConnections.profileId, profile.id))
        .limit(1)

      if (!stripeConnection) {
        return jsonResponse({ error: "profile_not_found", message: "That public profile was not found." }, 404)
      }

      let restrictedKey: string
      try {
        restrictedKey = decryptStripeKey(
          stripeConnection.encryptedKey,
          stripeConnection.encryptionIv,
          stripeConnection.encryptionVersion,
        )
      } catch {
        return jsonResponse(
          { error: "resync_failed", message: "The stored Stripe credential could not be read." },
          500,
        )
      }

      let syncData: Awaited<ReturnType<typeof syncInitialStripeData>>
      try {
        syncData = await syncInitialStripeData(createStripeClient(restrictedKey))
      } catch (error) {
        if (error instanceof StripeSyncLimitError) {
          return jsonResponse(
            { error: "sync_limit_exceeded", message: "The Stripe sync exceeded the safe record limit." },
            422,
          )
        }
        return jsonResponse(
          { error: "stripe_unavailable", message: "Stripe could not complete the read-only sync." },
          502,
        )
      }

      const encryptedPayload = encryptProviderPayload("stripe", syncData.rawPayload)

      await db.transaction(async (tx) => {
        await tx
          .update(stripeConnections)
          .set({ lastValidatedAt: now, updatedAt: now })
          .where(eq(stripeConnections.profileId, profile.id))

        await tx
          .insert(providerPayloadSnapshots)
          .values({
            profileId: profile.id,
            provider: "stripe",
            ...encryptedPayload,
            fetchedAt: now,
          })
          .onConflictDoUpdate({
            target: providerPayloadSnapshots.profileId,
            set: {
              provider: "stripe",
              encryptedPayload: encryptedPayload.encryptedPayload,
              encryptionIv: encryptedPayload.encryptionIv,
              encryptionVersion: encryptedPayload.encryptionVersion,
              fetchedAt: now,
            },
          })

        for (const snapshot of syncData.snapshots) {
          await tx
            .insert(revenueSnapshots)
            .values({ profileId: profile.id, ...snapshot, recordedAt: now })
            .onConflictDoUpdate({
              target: [
                revenueSnapshots.profileId,
                revenueSnapshots.periodStart,
                revenueSnapshots.periodEnd,
                revenueSnapshots.currency,
              ],
              set: {
                grossChargeAmountMinor: snapshot.grossChargeAmountMinor,
                refundedAmountMinor: snapshot.refundedAmountMinor,
                successfulChargeCount: snapshot.successfulChargeCount,
                activeSubscriptionCount: snapshot.activeSubscriptionCount,
                mrrMinor: snapshot.mrrMinor,
                recordedAt: now,
              },
            })
        }

        const productIds = syncData.products.map((product) => product.stripeProductId)
        await tx
          .update(stripeProducts)
          .set({ active: false, updatedAt: now })
          .where(
            productIds.length > 0
              ? and(
                  eq(stripeProducts.profileId, profile.id),
                  notInArray(stripeProducts.stripeProductId, productIds),
                )
              : eq(stripeProducts.profileId, profile.id),
          )

        for (const product of syncData.products) {
          await tx
            .insert(stripeProducts)
            .values({ profileId: profile.id, ...product, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: [stripeProducts.profileId, stripeProducts.stripeProductId],
              set: {
                name: product.name,
                active: product.active,
                lastSyncedAt: product.lastSyncedAt,
                updatedAt: now,
              },
            })
        }

        const planIds = syncData.plans.map((plan) => plan.stripePlanId)
        await tx
          .update(stripePlans)
          .set({ active: false, updatedAt: now })
          .where(
            planIds.length > 0
              ? and(eq(stripePlans.profileId, profile.id), notInArray(stripePlans.stripePlanId, planIds))
              : eq(stripePlans.profileId, profile.id),
          )

        for (const plan of syncData.plans) {
          await tx
            .insert(stripePlans)
            .values({ profileId: profile.id, ...plan, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: [stripePlans.profileId, stripePlans.stripePlanId],
              set: {
                stripeProductId: plan.stripeProductId,
                nickname: plan.nickname,
                amountMinor: plan.amountMinor,
                currency: plan.currency,
                billingInterval: plan.billingInterval,
                intervalCount: plan.intervalCount,
                active: plan.active,
                lastSyncedAt: plan.lastSyncedAt,
                updatedAt: now,
              },
            })
        }

        const chargeEvents = syncData.chargeEvents.map((event) => ({
          profileId: profile.id,
          ...event,
        }))
        for (let index = 0; index < chargeEvents.length; index += CHARGE_EVENT_INSERT_BATCH) {
          await tx
            .insert(profileChargeEvents)
            .values(chargeEvents.slice(index, index + CHARGE_EVENT_INSERT_BATCH))
            .onConflictDoNothing({
              target: [profileChargeEvents.profileId, profileChargeEvents.chargeId],
            })
        }
      })

      revalidatePath(`/@${profile.handle}`)
      revalidatePath(`/edit/${profile.handle}`)

      return jsonResponse(
        {
          providerId: "stripe",
          resyncedAt: now.toISOString(),
          counts: {
            snapshots: syncData.snapshots.length,
            products: syncData.products.length,
            plans: syncData.plans.length,
            chargeEvents: syncData.chargeEvents.length,
          },
        },
        200,
      )
    }

    const [providerConnection] = await db
      .select({
        provider: paymentProviderConnections.provider,
        encryptedCredentials: paymentProviderConnections.encryptedCredentials,
        encryptionIv: paymentProviderConnections.encryptionIv,
        encryptionVersion: paymentProviderConnections.encryptionVersion,
      })
      .from(paymentProviderConnections)
      .where(eq(paymentProviderConnections.profileId, profile.id))
      .limit(1)

    if (!providerConnection || !isRevenueProviderId(providerConnection.provider)) {
      return jsonResponse({ error: "profile_not_found", message: "That public profile was not found." }, 404)
    }
    if (credentialProof.providerId !== providerConnection.provider) {
      return jsonResponse(
        { error: "invalid_provider", message: "The selected provider does not match this profile." },
        400,
      )
    }

    let credentials: ReturnType<typeof parseProviderCredentials>
    try {
      const stored = JSON.parse(
        decryptProviderCredentials(
          providerConnection.provider,
          providerConnection.encryptedCredentials,
          providerConnection.encryptionIv,
          providerConnection.encryptionVersion,
        ),
      ) as unknown
      credentials = parseProviderCredentials(providerConnection.provider, stored)
    } catch {
      credentials = null
    }
    if (!credentials) {
      return jsonResponse(
        { error: "resync_failed", message: "The stored provider credentials could not be read." },
        500,
      )
    }

    let syncData: Awaited<ReturnType<typeof syncRevenueProvider>>
    try {
      syncData = await syncRevenueProvider(providerConnection.provider, credentials)
    } catch (error) {
      const failure = providerSyncFailure(error)
      if (failure) return jsonResponse({ error: failure.error, message: failure.message }, failure.status)
      throw error
    }

    const encryptedPayload = encryptProviderPayload(
      providerConnection.provider,
      syncData.rawResponses ?? [],
    )

    await db.transaction(async (tx) => {
      await tx
        .update(paymentProviderConnections)
        .set({ lastValidatedAt: syncData.validatedAt, lastSyncedAt: now, updatedAt: now })
        .where(eq(paymentProviderConnections.profileId, profile.id))

      await tx
        .insert(providerPayloadSnapshots)
        .values({
          profileId: profile.id,
          provider: providerConnection.provider,
          ...encryptedPayload,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: providerPayloadSnapshots.profileId,
          set: {
            provider: providerConnection.provider,
            encryptedPayload: encryptedPayload.encryptedPayload,
            encryptionIv: encryptedPayload.encryptionIv,
            encryptionVersion: encryptedPayload.encryptionVersion,
            fetchedAt: now,
          },
        })

      for (const snapshot of syncData.snapshots) {
        await tx
          .insert(revenueSnapshots)
          .values({ profileId: profile.id, ...snapshot, recordedAt: now })
          .onConflictDoUpdate({
            target: [
              revenueSnapshots.profileId,
              revenueSnapshots.periodStart,
              revenueSnapshots.periodEnd,
              revenueSnapshots.currency,
            ],
            set: {
              grossChargeAmountMinor: snapshot.grossChargeAmountMinor,
              refundedAmountMinor: snapshot.refundedAmountMinor,
              successfulChargeCount: snapshot.successfulChargeCount,
              activeSubscriptionCount: snapshot.activeSubscriptionCount,
              mrrMinor: snapshot.mrrMinor,
              recordedAt: now,
            },
          })
      }

      const catalogItems = syncData.catalogItems
      const productIds = catalogItems
        .filter((item) => item.itemKind === "product")
        .map((item) => item.externalId)
      const planIds = catalogItems
        .filter((item) => item.itemKind === "plan")
        .map((item) => item.externalId)

      await tx
        .update(paymentProviderCatalogItems)
        .set({ active: false, updatedAt: now })
        .where(
          and(
            eq(paymentProviderCatalogItems.profileId, profile.id),
            eq(paymentProviderCatalogItems.provider, providerConnection.provider),
            eq(paymentProviderCatalogItems.itemKind, "product"),
            productIds.length > 0
              ? notInArray(paymentProviderCatalogItems.externalId, productIds)
              : undefined,
          ),
        )

      await tx
        .update(paymentProviderCatalogItems)
        .set({ active: false, updatedAt: now })
        .where(
          and(
            eq(paymentProviderCatalogItems.profileId, profile.id),
            eq(paymentProviderCatalogItems.provider, providerConnection.provider),
            eq(paymentProviderCatalogItems.itemKind, "plan"),
            planIds.length > 0
              ? notInArray(paymentProviderCatalogItems.externalId, planIds)
              : undefined,
          ),
        )

      for (const item of catalogItems) {
        await tx
          .insert(paymentProviderCatalogItems)
          .values({
            profileId: profile.id,
            provider: providerConnection.provider,
            itemKind: item.itemKind,
            externalId: item.externalId,
            productExternalId: item.productExternalId,
            name: item.name,
            amountMinor: item.amountMinor,
            currency: item.currency,
            billingInterval: item.billingInterval,
            intervalCount: item.intervalCount,
            active: item.active,
            lastSyncedAt: item.lastSyncedAt,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              paymentProviderCatalogItems.profileId,
              paymentProviderCatalogItems.provider,
              paymentProviderCatalogItems.itemKind,
              paymentProviderCatalogItems.externalId,
            ],
            set: {
              productExternalId: item.productExternalId,
              name: item.name,
              amountMinor: item.amountMinor,
              currency: item.currency,
              billingInterval: item.billingInterval,
              intervalCount: item.intervalCount,
              active: item.active,
              lastSyncedAt: item.lastSyncedAt,
              updatedAt: now,
            },
          })
      }
    })

    revalidatePath(`/@${profile.handle}`)
    revalidatePath(`/edit/${profile.handle}`)

    return jsonResponse(
      {
        providerId: providerConnection.provider,
        resyncedAt: now.toISOString(),
        counts: {
          snapshots: syncData.snapshots.length,
          products: syncData.catalogItems.filter((item) => item.itemKind === "product").length,
          plans: syncData.catalogItems.filter((item) => item.itemKind === "plan").length,
          chargeEvents: 0,
        },
      },
      200,
    )
  } catch {
    return jsonResponse(
      { error: "resync_failed", message: "The latest provider data could not be synced." },
      500,
    )
  }
}
