import { ipAddress } from "@vercel/functions"
import { and, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { verifyProfileCredentialProof } from "@/lib/profile-credential-proof"
import { getRevenueSourceName, isRevenueProviderId } from "@/lib/providers/registry"
import { limitEditorAccess } from "@/lib/security/rate-limit"
import { isKeyEncryptionConfigured } from "@/lib/stripe/crypto"
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  let rateLimit: Awaited<ReturnType<typeof limitEditorAccess>>
  try {
    rateLimit = await limitEditorAccess(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      { error: "rate_limit_unavailable", message: "Secure editor access is temporarily unavailable." },
      503,
    )
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterSeconds,
        message: "Too many credential verification attempts.",
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
      { error: "encryption_unavailable", message: "Secure editor access is temporarily unavailable." },
      503,
    )
  }

  try {
    const [profile] = await db
      .select({
        id: profiles.id,
        handle: profiles.handle,
        displayName: profiles.displayName,
        bio: profiles.bio,
        contactEmail: profiles.contactEmail,
        websiteUrl: profiles.websiteUrl,
        appUrl: profiles.appUrl,
        socialLinks: profiles.socialLinks,
      })
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

    return jsonResponse(
      {
        providerId: credentialProof.providerId,
        providerName: getRevenueSourceName(credentialProof.providerId),
        profile: {
          handle: profile.handle,
          displayName: profile.displayName,
          bio: profile.bio,
          contactEmail: profile.contactEmail ?? "",
          websiteUrl: profile.websiteUrl ?? "",
          appUrl: profile.appUrl ?? "",
          socialLinks: profile.socialLinks,
        },
      },
      200,
    )
  } catch {
    return jsonResponse(
      { error: "editor_access_failed", message: "The editor could not be unlocked." },
      500,
    )
  }
}
