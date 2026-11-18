import { ipAddress } from "@vercel/functions"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  profileChargeEvents,
  profiles,
  providerPayloadSnapshots,
  revenueSnapshots,
  stripeConnections,
  stripePlans,
  stripeProducts,
  stripeVerificationRuns,
} from "@/lib/db/schema"
import { limitProfileCreation } from "@/lib/security/rate-limit"
import {
  cleanProfileText,
  parseContactEmail,
  parseProfileUrl,
  parseSocialLinks,
} from "@/lib/profile-validation"
import { createStripeClient } from "@/lib/stripe/client"
import {
  encryptProviderPayload,
  encryptStripeKey,
  isKeyEncryptionConfigured,
} from "@/lib/stripe/crypto"
import { probeStripePermissions } from "@/lib/stripe/probes"
import { StripeSyncLimitError, syncInitialStripeData } from "@/lib/stripe/sync"
import { REQUIRED_STRIPE_PERMISSIONS } from "@/lib/stripe-permissions"
import { normalizeHandle } from "@/lib/profiles"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_REQUEST_BYTES = 24_576
const CHARGE_EVENT_INSERT_BATCH = 500

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  additionalHeaders: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...additionalHeaders,
    },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScopeReviewComplete(body: Record<string, unknown>) {
  const expectedPermissions = REQUIRED_STRIPE_PERMISSIONS.map((permission) => permission.key)
  const reviewed = Array.isArray(body.reviewedPermissionKeys)
    ? body.reviewedPermissionKeys.filter((key): key is string => typeof key === "string")
    : []
  const reviewedSet = new Set(reviewed)

  return (
    reviewedSet.size === expectedPermissions.length &&
    expectedPermissions.every((permission) => reviewedSet.has(permission)) &&
    body.noAdditionalPermissionsConfirmed === true
  )
}

function stripeStatusCode(error: unknown) {
  if (!isRecord(error) || typeof error.statusCode !== "number") return null
  return error.statusCode
}

class HandleAlreadyClaimedError extends Error {}

export async function POST(request: NextRequest) {
  let rateLimit: Awaited<ReturnType<typeof limitProfileCreation>>
  try {
    rateLimit = await limitProfileCreation(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      {
        error: "rate_limit_unavailable",
        message: "Secure profile creation is temporarily unavailable.",
      },
      503,
    )
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return jsonResponse(
      {
        error: "rate_limited",
        retryAfterSeconds,
        message: "Too many profile creation attempts.",
      },
      429,
      { "Retry-After": String(retryAfterSeconds) },
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

  const handle = typeof body.handle === "string" ? normalizeHandle(body.handle) : null
  const displayName = cleanProfileText(body.displayName, 80)
  const bio = cleanProfileText(body.bio ?? "", 280)
  const contactEmail = parseContactEmail(body.contactEmail)
  const websiteUrl = parseProfileUrl(body.websiteUrl)
  const appUrl = parseProfileUrl(body.appUrl)
  const socialLinks = parseSocialLinks(body.socialLinks)
  const stripeRestrictedKey = typeof body.stripeRestrictedKey === "string"
    ? body.stripeRestrictedKey.trim()
    : ""

  if (
    !handle ||
    !displayName ||
    bio === null ||
    contactEmail === undefined ||
    websiteUrl === undefined ||
    appUrl === undefined ||
    socialLinks === undefined
  ) {
    return jsonResponse(
      {
        error: "invalid_input",
        message: "Check the handle, profile details, public email, and link fields.",
      },
      400,
    )
  }
  if (!isScopeReviewComplete(body)) {
    return jsonResponse(
      {
        error: "scope_review_required",
        message: "Confirm the exact required read permissions and that no extra permissions are enabled.",
      },
      400,
    )
  }
  if (!isKeyEncryptionConfigured()) {
    return jsonResponse(
      {
        error: "encryption_unavailable",
        message: "Server-side credential encryption is not configured.",
      },
      503,
    )
  }
  if (
    stripeRestrictedKey.length > 255 ||
    !/^rk_live_[A-Za-z0-9_]+$/.test(stripeRestrictedKey)
  ) {
    return jsonResponse(
      {
        error: "invalid_key_format",
        message: "Use an active live restricted key beginning with rk_live_.",
      },
      400,
    )
  }

  try {
    const [existingProfile] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.handle, handle))
      .limit(1)
    if (existingProfile) {
      return jsonResponse({ error: "handle_taken", message: "That handle is already in use." }, 409)
    }

    let encryptedKey: ReturnType<typeof encryptStripeKey>
    try {
      encryptedKey = encryptStripeKey(stripeRestrictedKey)
    } catch {
      return jsonResponse(
        {
          error: "encryption_unavailable",
          message: "Server-side credential encryption is not configured.",
        },
        503,
      )
    }

    const stripe = createStripeClient(stripeRestrictedKey)
    const startedAt = new Date()
    const probeReport = await probeStripePermissions(stripe)

    if (probeReport.status === "invalid_key") {
      return jsonResponse(
        {
          error: "invalid_key",
          message: "Stripe could not authenticate this restricted key.",
        },
        422,
      )
    }
    if (probeReport.status === "missing_permissions") {
      return jsonResponse(
        {
          error: "missing_permissions",
          missingPermissions: probeReport.missingPermissions,
          message: "One or more required read probes were denied.",
        },
        422,
      )
    }
    if (probeReport.status !== "passed") {
      return jsonResponse(
        {
          error: "stripe_unavailable",
          message: "Stripe could not complete the required read-only probes.",
        },
        502,
      )
    }

    let initialData: Awaited<ReturnType<typeof syncInitialStripeData>>
    try {
      initialData = await syncInitialStripeData(stripe)
    } catch (error) {
      if (error instanceof StripeSyncLimitError) {
        return jsonResponse(
          {
            error: "sync_limit_exceeded",
            message: "The first sync exceeded the safe record limit.",
          },
          422,
        )
      }
      const statusCode = stripeStatusCode(error)
      if (statusCode === 401) {
        return jsonResponse(
          { error: "invalid_key", message: "Stripe could not authenticate this restricted key." },
          422,
        )
      }
      if (statusCode === 403) {
        return jsonResponse(
          {
            error: "missing_permissions",
            message: "A read-only data request was denied. Review the key permissions in Stripe Dashboard.",
          },
          422,
        )
      }
      return jsonResponse(
        {
          error: "sync_failed",
          message: "Stripe could not complete the initial read-only sync.",
        },
        502,
      )
    }

    const now = new Date()
    const encryptedPayload = encryptProviderPayload("stripe", initialData.rawPayload)
    const profilePath = `/@${handle}`

    await db.transaction(async (tx) => {
      const [profile] = await tx
        .insert(profiles)
        .values({
          handle,
          displayName,
          bio,
          contactEmail,
          websiteUrl,
          appUrl,
          socialLinks,
          status: "published",
          updatedAt: now,
          publishedAt: now,
        })
        .onConflictDoNothing({ target: profiles.handle })
        .returning({ id: profiles.id })

      if (!profile) throw new HandleAlreadyClaimedError()

      await tx.insert(stripeConnections).values({
        profileId: profile.id,
        encryptedKey: encryptedKey.encryptedKey,
        encryptionIv: encryptedKey.encryptionIv,
        encryptionVersion: encryptedKey.encryptionVersion,
        keyMode: "live",
        status: "capabilities_passed",
        capabilityProbeResults: probeReport.results,
        dashboardScopeReviewedAt: now,
        lastValidatedAt: now,
        updatedAt: now,
      })

      await tx.insert(stripeVerificationRuns).values({
        profileId: profile.id,
        status: "dashboard_review_confirmed",
        capabilityResults: probeReport.results,
        dashboardScopeConfirmed: true,
        startedAt,
        completedAt: now,
      })

      await tx.insert(providerPayloadSnapshots).values({
        profileId: profile.id,
        provider: "stripe",
        ...encryptedPayload,
        fetchedAt: now,
      })

      if (initialData.snapshots.length > 0) {
        await tx.insert(revenueSnapshots).values(
          initialData.snapshots.map((snapshot) => ({
            profileId: profile.id,
            ...snapshot,
            recordedAt: now,
          })),
        )
      }
      if (initialData.products.length > 0) {
        await tx.insert(stripeProducts).values(
          initialData.products.map((product) => ({
            profileId: profile.id,
            ...product,
            createdAt: now,
            updatedAt: now,
          })),
        )
      }
      if (initialData.plans.length > 0) {
        await tx.insert(stripePlans).values(
          initialData.plans.map((plan) => ({
            profileId: profile.id,
            ...plan,
            createdAt: now,
            updatedAt: now,
          })),
        )
      }

      const chargeEvents = initialData.chargeEvents.map((event) => ({
        profileId: profile.id,
        ...event,
      }))
      for (let index = 0; index < chargeEvents.length; index += CHARGE_EVENT_INSERT_BATCH) {
        await tx
          .insert(profileChargeEvents)
          .values(chargeEvents.slice(index, index + CHARGE_EVENT_INSERT_BATCH))
      }
    })

    revalidatePath(profilePath)
    return jsonResponse({ handle, profilePath }, 201)
  } catch (error) {
    if (error instanceof HandleAlreadyClaimedError) {
      return jsonResponse({ error: "handle_taken", message: "That handle is already in use." }, 409)
    }
    return jsonResponse(
      {
        error: "profile_creation_failed",
        message: "The profile could not be created. No Stripe key or raw response was returned.",
      },
      500,
    )
  }
}
