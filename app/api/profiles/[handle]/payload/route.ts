import { ipAddress } from "@vercel/functions"
import { and, eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import { db } from "@/lib/db"
import { profiles, providerPayloadSnapshots } from "@/lib/db/schema"
import { verifyProfileCredentialProof } from "@/lib/profile-credential-proof"
import { limitPayloadViewing } from "@/lib/security/rate-limit"
import { getRevenueSourceName, isRevenueProviderId } from "@/lib/providers/registry"
import { decryptProviderPayload, isKeyEncryptionConfigured } from "@/lib/stripe/crypto"
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
  let rateLimit: Awaited<ReturnType<typeof limitPayloadViewing>>
  try {
    rateLimit = await limitPayloadViewing(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse(
      { error: "rate_limit_unavailable", message: "Secure payload access is temporarily unavailable." },
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
      { error: "encryption_unavailable", message: "Secure payload access is temporarily unavailable." },
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

    const [payloadSnapshot] = await db
      .select({
        encryptedPayload: providerPayloadSnapshots.encryptedPayload,
        encryptionIv: providerPayloadSnapshots.encryptionIv,
        encryptionVersion: providerPayloadSnapshots.encryptionVersion,
        fetchedAt: providerPayloadSnapshots.fetchedAt,
      })
      .from(providerPayloadSnapshots)
      .where(
        and(
          eq(providerPayloadSnapshots.profileId, profile.id),
          eq(providerPayloadSnapshots.provider, credentialProof.providerId),
        ),
      )
      .limit(1)

    if (!payloadSnapshot) {
      return jsonResponse(
        {
          error: "payload_not_found",
          message: "No raw provider payload is stored for this profile.",
        },
        404,
      )
    }

    let payload: unknown
    try {
      payload = decryptProviderPayload(
        credentialProof.providerId,
        payloadSnapshot.encryptedPayload,
        payloadSnapshot.encryptionIv,
        payloadSnapshot.encryptionVersion,
      )
    } catch {
      return jsonResponse(
        {
          error: "payload_unavailable",
          message: "The stored provider payload could not be decrypted.",
        },
        500,
      )
    }

    return jsonResponse(
      {
        provider: credentialProof.providerId,
        providerName: getRevenueSourceName(credentialProof.providerId),
        fetchedAt: payloadSnapshot.fetchedAt.toISOString(),
        payload,
      },
      200,
    )
  } catch {
    return jsonResponse(
      { error: "payload_fetch_failed", message: "The raw provider payload could not be loaded." },
      500,
    )
  }
}
