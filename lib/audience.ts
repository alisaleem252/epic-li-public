import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { profileAudience, type AudienceSource } from "@/lib/db/schema"
import { PROFILE_SOCIAL_PLATFORMS, type ProfileSocialLinks, type ProfileSocialPlatform } from "@/lib/profile-links"

export const MAX_FOLLOWERS = 1_000_000_000

export type AudienceEntry = {
  platform: ProfileSocialPlatform
  label: string
  followers: number
  source: AudienceSource
}

export type ProfileAudience = {
  entries: AudienceEntry[]
  totalFollowers: number
  verifiedFollowers: number
}

const PLATFORM_LABELS = new Map<string, string>(PROFILE_SOCIAL_PLATFORMS.map((p) => [p.key, p.label]))

export async function getProfileAudience(profileId: string): Promise<ProfileAudience> {
  const rows = await db
    .select({
      platform: profileAudience.platform,
      followers: profileAudience.followers,
      source: profileAudience.source,
    })
    .from(profileAudience)
    .where(eq(profileAudience.profileId, profileId))

  const entries: AudienceEntry[] = rows
    .filter((row) => PLATFORM_LABELS.has(row.platform))
    .map((row) => ({
      platform: row.platform as ProfileSocialPlatform,
      label: PLATFORM_LABELS.get(row.platform) ?? row.platform,
      followers: Number(row.followers),
      source: row.source,
    }))
    .sort((a, b) => b.followers - a.followers)

  return {
    entries,
    totalFollowers: entries.reduce((sum, entry) => sum + entry.followers, 0),
    verifiedFollowers: entries.filter((e) => e.source === "verified").reduce((sum, e) => sum + e.followers, 0),
  }
}

export function githubUsernameFromUrl(value: string | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null
    const [name] = url.pathname.split("/").filter(Boolean)
    return name && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(name) ? name : null
  } catch {
    return null
  }
}

/**
 * Follower count from GitHub's public REST API (no key needed; set GITHUB_TOKEN to raise the
 * unauthenticated 60 requests/hour/IP limit). Returns null on any failure so callers keep old data.
 */
export async function fetchGitHubFollowers(username: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "epic-li",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const followers = typeof body === "object" && body !== null ? (body as { followers?: unknown }).followers : null
    return typeof followers === "number" && Number.isInteger(followers) && followers >= 0 ? followers : null
  } catch {
    return null
  }
}

export type AudienceSaveResult = { githubVerified: boolean | null }

/**
 * Saves owner-entered counts. Only platforms with a link on the profile are accepted, so numbers
 * can't float free of an account. GitHub is never taken from the request: it is fetched and
 * stored as "verified". Everything else is stored as "self_reported".
 */
export async function saveProfileAudience(
  profileId: string,
  counts: Partial<Record<ProfileSocialPlatform, number | null>>,
  socialLinks: ProfileSocialLinks,
): Promise<AudienceSaveResult> {
  const now = new Date()
  const toDelete: string[] = []
  const toUpsert: Array<{ platform: string; followers: number; source: AudienceSource }> = []
  let githubVerified: boolean | null = null

  for (const platform of PROFILE_SOCIAL_PLATFORMS) {
    const key = platform.key
    if (!socialLinks[key]) {
      toDelete.push(key)
      continue
    }
    if (key === "github") {
      const username = githubUsernameFromUrl(socialLinks.github)
      const followers = username ? await fetchGitHubFollowers(username) : null
      githubVerified = followers !== null
      if (followers !== null) toUpsert.push({ platform: key, followers, source: "verified" })
      continue
    }
    if (!(key in counts)) continue
    const value = counts[key]
    if (value === null || value === undefined) toDelete.push(key)
    else toUpsert.push({ platform: key, followers: value, source: "self_reported" })
  }

  await db.transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx
        .delete(profileAudience)
        .where(and(eq(profileAudience.profileId, profileId), inArray(profileAudience.platform, toDelete)))
    }
    for (const row of toUpsert) {
      await tx
        .insert(profileAudience)
        .values({
          profileId,
          platform: row.platform,
          followers: BigInt(row.followers),
          source: row.source,
          checkedAt: row.source === "verified" ? now : null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [profileAudience.profileId, profileAudience.platform],
          set: {
            followers: BigInt(row.followers),
            source: row.source,
            checkedAt: row.source === "verified" ? now : null,
            updatedAt: now,
          },
        })
    }
  })

  return { githubVerified }
}
