import { ipAddress } from "@vercel/functions"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  paymentProviderCatalogItems,
  paymentProviderConnections,
  profiles,
  providerPayloadSnapshots,
  revenueSnapshots,
} from "@/lib/db/schema"
import { limitProfileCreation } from "@/lib/security/rate-limit"
import {
  cleanProfileText,
  parseContactEmail,
  parseProfileUrl,
  parseSocialLinks,
} from "@/lib/profile-validation"
import {
  encryptProviderCredentials,
  encryptProviderPayload,
  isKeyEncryptionConfigured,
} from "@/lib/stripe/crypto"
import {
  parseProviderCredentials,
  serializeProviderCredentials,
} from "@/lib/providers/credentials"
import {
  ProviderApiError,
  ProviderAuthenticationError,
  ProviderSyncLimitError,
  ProviderUnavailableError,
} from "@/lib/providers/common"
import { isRevenueProviderId } from "@/lib/providers/registry"
import { syncRevenueProvider } from "@/lib/providers/sync"
import { normalizeHandle } from "@/lib/profiles"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_REQUEST_BYTES = 24_576

function jsonResponse(body: Record<string, unknown>, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

class HandleAlreadyClaimedError extends Error {}

export async function POST(request: NextRequest) {
  let rateLimit: Awaited<ReturnType<typeof limitProfileCreation>>
  try {
    rateLimit = await limitProfileCreation(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      { error: "rate_limit_unavailable", message: "Secure profile creation is temporarily unavailable." },
      503,
    )
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return jsonResponse(
      { error: "rate_limited", retryAfterSeconds, message: "Too many profile creation attempts." },
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
      { error: "invalid_input", message: "Check the handle, profile details, public email, and link fields." },
      400,
    )
  }

  const providerId = isRevenueProviderId(body.providerId) ? body.providerId : null
  if (!providerId) {
    return jsonResponse({ error: "invalid_provider", message: "Choose a supported revenue provider." }, 400)
  }
  const credentials = parseProviderCredentials(providerId, body.credentials)
  if (!credentials) {
    return jsonResponse(
      { error: "invalid_provider_credentials", message: "Check the required provider credentials and try again." },
      400,
    )
  }
  if (!isKeyEncryptionConfigured()) {
    return jsonResponse(
      { error: "encryption_unavailable", message: "Secure profile creation is temporarily unavailable." },
      503,
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

    let syncResult
    try {
      syncResult = await syncRevenueProvider(providerId, credentials)
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        return jsonResponse(
          {
            error: "provider_auth_failed",
            message: "The provider rejected the credentials or a required read permission is missing.",
          },
          422,
        )
      }
      if (error instanceof ProviderSyncLimitError) {
        return jsonResponse(
          { error: "sync_limit_exceeded", message: "The initial provider sync exceeded the safe record limit." },
          422,
        )
      }
      if (error instanceof ProviderApiError && [400, 422].includes(error.status)) {
        return jsonResponse(
          { error: "provider_request_invalid", message: "The provider rejected the request. Check account details and read permissions." },
          422,
        )
      }
      if (error instanceof ProviderUnavailableError || error instanceof ProviderApiError) {
        return jsonResponse(
          { error: "provider_unavailable", message: "The provider could not complete the read-only sync. Try again later." },
          502,
        )
      }
      throw error
    }

    const encrypted = encryptProviderCredentials(providerId, serializeProviderCredentials(credentials))
    const now = new Date()
    const encryptedPayload = encryptProviderPayload(providerId, syncResult.rawResponses ?? [])
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

      await tx.insert(paymentProviderConnections).values({
        profileId: profile.id,
        provider: providerId,
        encryptedCredentials: encrypted.encryptedCredentials,
        encryptionIv: encrypted.encryptionIv,
        encryptionVersion: encrypted.encryptionVersion,
        status: "connected",
        lastValidatedAt: syncResult.validatedAt,
        lastSyncedAt: now,
        updatedAt: now,
      })

      await tx.insert(providerPayloadSnapshots).values({
        profileId: profile.id,
        provider: providerId,
        ...encryptedPayload,
        fetchedAt: now,
      })

      if (syncResult.snapshots.length > 0) {
        await tx.insert(revenueSnapshots).values(
          syncResult.snapshots.map((snapshot) => ({
            profileId: profile.id,
            ...snapshot,
            recordedAt: now,
          })),
        )
      }

      if (syncResult.catalogItems.length > 0) {
        await tx.insert(paymentProviderCatalogItems).values(
          syncResult.catalogItems.map((item) => ({
            profileId: profile.id,
            provider: providerId,
            ...item,
            createdAt: now,
            updatedAt: now,
          })),
        )
      }
    })

    revalidatePath(profilePath)
    return jsonResponse({ handle, profilePath, providerId }, 201)
  } catch (error) {
    if (error instanceof HandleAlreadyClaimedError) {
      return jsonResponse({ error: "handle_taken", message: "That handle is already in use." }, 409)
    }
    return jsonResponse(
      {
        error: "profile_creation_failed",
        message: "The profile could not be created. Provider credentials and raw responses are never returned.",
      },
      500,
    )
  }
}
