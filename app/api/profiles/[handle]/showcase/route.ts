import { ipAddress } from "@vercel/functions"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { getProfileAudience, MAX_FOLLOWERS, saveProfileAudience } from "@/lib/audience"
import { getOwnerCatalog, MAX_CATALOG_ITEMS, setCatalogVisibility } from "@/lib/catalog-visibility"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { verifyProfileCredentialProof } from "@/lib/profile-credential-proof"
import { PROFILE_SOCIAL_PLATFORMS, type ProfileSocialPlatform } from "@/lib/profile-links"
import { isRevenueProviderId } from "@/lib/providers/registry"
import { normalizeHandle } from "@/lib/profiles"
import { limitShowcase } from "@/lib/security/rate-limit"
import { isKeyEncryptionConfigured } from "@/lib/stripe/crypto"

/**
 * Owner-only "showcase" settings: which catalog items are public, and per-platform follower counts.
 * POST { action: "load" | "save", ...credential proof, hidden?, followers? }.
 * Same ownership model as profile editing: the original provider credential, compared server-side.
 */
export const runtime = "nodejs"

const MAX_REQUEST_BYTES = 49_152

type RouteContext = { params: Promise<{ handle: string }> }

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseIdList(value: unknown): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_CATALOG_ITEMS * 2) return null
  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || item.length > 160) return null
    ids.push(item)
  }
  return ids
}

function parseFollowers(value: unknown): Partial<Record<ProfileSocialPlatform, number | null>> | null {
  if (value === undefined) return {}
  if (!isRecord(value)) return null
  const allowed = new Set<string>(PROFILE_SOCIAL_PLATFORMS.map((p) => p.key))
  const result: Partial<Record<ProfileSocialPlatform, number | null>> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key)) return null
    if (raw === null || raw === "") {
      result[key as ProfileSocialPlatform] = null
      continue
    }
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_FOLLOWERS) return null
    result[key as ProfileSocialPlatform] = raw
  }
  return result
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  let rateLimit: Awaited<ReturnType<typeof limitShowcase>>
  try {
    rateLimit = await limitShowcase(ipAddress(request) ?? "unknown-client")
  } catch {
    return json({ error: "rate_limit_unavailable", message: "Secure profile editing is temporarily unavailable." }, 503)
  }
  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds, message: "Too many attempts." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) } },
    )
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ error: "invalid_content_type", message: "Send a JSON request." }, 415)
  }
  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "request_too_large", message: "The request is too large." }, 413)
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return json({ error: "invalid_request", message: "The request could not be read." }, 400)
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return json({ error: "request_too_large", message: "The request is too large." }, 413)
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: "invalid_json", message: "Send a valid JSON request." }, 400)
  }
  if (!isRecord(body) || (body.action !== "load" && body.action !== "save")) {
    return json({ error: "invalid_request", message: "The request fields are invalid." }, 400)
  }

  const { handle: rawHandle } = await params
  const handle = normalizeHandle(rawHandle)
  if (!handle) return json({ error: "profile_not_found", message: "That public profile was not found." }, 404)
  if (!isKeyEncryptionConfigured()) {
    return json({ error: "encryption_unavailable", message: "Secure profile editing is temporarily unavailable." }, 503)
  }

  const hiddenInput = isRecord(body.hidden) ? body.hidden : body.hidden === undefined ? {} : null
  const hiddenProducts = hiddenInput ? parseIdList(hiddenInput.products) : null
  const hiddenPlans = hiddenInput ? parseIdList(hiddenInput.plans) : null
  const followers = parseFollowers(body.followers)
  const featureOnHomepage = typeof body.featureOnHomepage === "boolean" ? body.featureOnHomepage : null
  if (body.action === "save" && (!hiddenProducts || !hiddenPlans || !followers)) {
    return json({ error: "invalid_input", message: "Check the hidden items and follower counts." }, 400)
  }

  try {
    const [profile] = await db
      .select({
        id: profiles.id,
        socialLinks: profiles.socialLinks,
        featureOnHomepage: profiles.featureOnHomepage,
        showcaseReviewedAt: profiles.showcaseReviewedAt,
      })
      .from(profiles)
      .where(and(eq(profiles.handle, handle), eq(profiles.status, "published")))
      .limit(1)
    if (!profile) return json({ error: "profile_not_found", message: "That public profile was not found." }, 404)

    const proof = await verifyProfileCredentialProof(profile.id, {
      requestedProviderId: isRevenueProviderId(body.providerId) ? body.providerId : null,
      stripeRestrictedKey: typeof body.stripeRestrictedKey === "string" ? body.stripeRestrictedKey.trim() : "",
      credentials: body.credentials,
    })
    if (!proof.ok) return json({ error: proof.error, message: proof.message }, proof.status)

    let githubVerified: boolean | null = null
    if (body.action === "save") {
      await setCatalogVisibility(profile.id, proof.providerId, {
        products: hiddenProducts ?? [],
        plans: hiddenPlans ?? [],
      })
      githubVerified = (await saveProfileAudience(profile.id, followers ?? {}, profile.socialLinks)).githubVerified
      // Saving the showcase counts as the owner's review; featuring only ever follows a review.
      const nextFeature = featureOnHomepage ?? profile.featureOnHomepage
      await db
        .update(profiles)
        .set({ featureOnHomepage: nextFeature, showcaseReviewedAt: new Date() })
        .where(eq(profiles.id, profile.id))
      profile.featureOnHomepage = nextFeature
      profile.showcaseReviewedAt = new Date()
      revalidatePath(`/@${handle}`)
      revalidatePath("/")
    }

    const [catalog, audience] = await Promise.all([
      getOwnerCatalog(profile.id, proof.providerId),
      getProfileAudience(profile.id),
    ])
    return json(
      {
        catalog,
        audience: audience.entries,
        socialLinks: profile.socialLinks,
        githubVerified,
        featureOnHomepage: profile.featureOnHomepage,
        reviewed: profile.showcaseReviewedAt !== null,
      },
      200,
    )
  } catch {
    return json({ error: "showcase_failed", message: "Showcase settings could not be processed." }, 500)
  }
}
