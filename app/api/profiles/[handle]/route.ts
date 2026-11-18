import { ipAddress } from "@vercel/functions"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { verifyProfileCredentialProof } from "@/lib/profile-credential-proof"
import { limitProfileEditing } from "@/lib/security/rate-limit"
import {
  cleanProfileText,
  parseContactEmail,
  parseProfileUrl,
  parseSocialLinks,
} from "@/lib/profile-validation"
import { isKeyEncryptionConfigured } from "@/lib/stripe/crypto"
import { isRevenueProviderId } from "@/lib/providers/registry"
import { normalizeHandle } from "@/lib/profiles"

export const runtime = "nodejs"

const MAX_REQUEST_BYTES = 24_576

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

function isUniqueViolation(error: unknown) {
  return isRecord(error) && error.code === "23505"
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  let rateLimit: Awaited<ReturnType<typeof limitProfileEditing>>
  try {
    rateLimit = await limitProfileEditing(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      { error: "rate_limit_unavailable", message: "Secure profile editing is temporarily unavailable." },
      503,
    )
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterSeconds,
        message: "Too many profile edit attempts.",
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
  const nextHandle = typeof body.handle === "string" ? normalizeHandle(body.handle) : null
  const displayName = cleanProfileText(body.displayName, 80)
  const bio = cleanProfileText(body.bio ?? "", 280)
  const contactEmail = parseContactEmail(body.contactEmail)
  const websiteUrl = parseProfileUrl(body.websiteUrl)
  const appUrl = parseProfileUrl(body.appUrl)
  const socialLinks = parseSocialLinks(body.socialLinks)
  const stripeRestrictedKey = typeof body.stripeRestrictedKey === "string"
    ? body.stripeRestrictedKey.trim()
    : ""
  const requestedProviderId = isRevenueProviderId(body.providerId) ? body.providerId : null

  if (
    !currentHandle ||
    !nextHandle ||
    !displayName ||
    bio === null ||
    contactEmail === undefined ||
    websiteUrl === undefined ||
    appUrl === undefined ||
    socialLinks === undefined
  ) {
    return jsonResponse(
      { error: "invalid_input", message: "Check the handle, profile details, email, and links." },
      400,
    )
  }

  if (!isKeyEncryptionConfigured()) {
    return jsonResponse(
      { error: "encryption_unavailable", message: "Secure profile editing is temporarily unavailable." },
      503,
    )
  }

  try {
    const [profile] = await db
      .select({ id: profiles.id })
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

    let updatedProfile: { handle: string } | undefined
    try {
      const [updated] = await db
        .update(profiles)
        .set({
          handle: nextHandle,
          displayName,
          bio,
          contactEmail,
          websiteUrl,
          appUrl,
          socialLinks,
          updatedAt: new Date(),
        })
        .where(and(eq(profiles.id, profile.id), eq(profiles.status, "published")))
        .returning({ handle: profiles.handle })
      updatedProfile = updated
    } catch (error) {
      if (isUniqueViolation(error)) {
        return jsonResponse({ error: "handle_taken", message: "That handle is already in use." }, 409)
      }
      throw error
    }

    if (!updatedProfile) {
      return jsonResponse({ error: "profile_not_found", message: "That public profile was not found." }, 404)
    }

    const profilePath = `/@${updatedProfile.handle}`
    revalidatePath(`/@${currentHandle}`)
    revalidatePath(profilePath)
    revalidatePath(`/edit/${currentHandle}`)
    revalidatePath(`/edit/${updatedProfile.handle}`)

    return jsonResponse({ handle: updatedProfile.handle, profilePath }, 200)
  } catch {
    return jsonResponse(
      { error: "profile_update_failed", message: "The profile could not be updated." },
      500,
    )
  }
}
