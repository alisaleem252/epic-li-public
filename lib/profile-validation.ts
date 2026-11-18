import "server-only"

import {
  PROFILE_SOCIAL_PLATFORMS,
  type ProfileSocialLinks,
} from "@/lib/profile-links"

export function cleanProfileText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim()
  return cleaned.length <= maxLength ? cleaned : null
}

export function parseProfileUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || value.length > 2048) return undefined

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

export function parseContactEmail(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== "string" || value.length > 254) return undefined

  const email = value.trim()
  if (!email) return null
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    return undefined
  }

  return email
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseSocialLinks(value: unknown): ProfileSocialLinks | undefined {
  if (!isRecord(value)) return undefined

  const allowedKeys = new Set<string>(PROFILE_SOCIAL_PLATFORMS.map(({ key }) => key))
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return undefined

  const links: ProfileSocialLinks = {}
  for (const platform of PROFILE_SOCIAL_PLATFORMS) {
    const rawValue = value[platform.key]
    if (rawValue === undefined || rawValue === null) continue
    if (typeof rawValue !== "string" || rawValue.length > 2048) return undefined

    const candidate = rawValue.trim()
    if (!candidate) continue

    const normalizedUrl = parseProfileUrl(candidate)
    if (!normalizedUrl) return undefined

    const url = new URL(normalizedUrl)
    const hostname = url.hostname.toLowerCase()
    const allowedHost = platform.allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
    if (url.protocol !== "https:" || !allowedHost) return undefined

    links[platform.key] = normalizedUrl
  }

  return links
}
