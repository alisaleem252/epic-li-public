import { SITE_URL } from "@/lib/site"
import { NextResponse, type NextRequest } from "next/server"
import { getBadgeData } from "@/lib/badge-data"
import {
  buildBadgeSvg,
  buildChestSvg,
  buildMerchSvg,
  buildStackedBadgeSvg,
  isBadgeShape,
  isBadgeMetric,
  isBadgeTheme,
  type BadgeMetric,
  type BadgeShape,
} from "@/lib/badge-svg"
import { normalizeHandle } from "@/lib/profiles"
import { qrMatrix } from "@/lib/qr"

/**
 * GET /badge/:handle?metric=mrr|revenue30|total|verified&theme=light|dark|green&variant=badge|merch&download=1
 * Public, read-only, cached SVG built from the same aggregates the public profile shows.
 * If the requested figure isn't reported for the profile, it falls back to the plain "verified" badge.
 */
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ handle: string }> }

const SECURITY_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  "Access-Control-Allow-Origin": "*",
  // Badges are embedded all over the web; let the CDN absorb the traffic.
  "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { handle: rawHandle } = await params
  const handle = normalizeHandle(rawHandle.replace(/\.svg$/i, ""))
  if (!handle) return new NextResponse("Not found", { status: 404 })

  const search = request.nextUrl.searchParams
  const requestedMetric = search.get("metric")
  const theme = isBadgeTheme(search.get("theme")) ? (search.get("theme") as "light" | "dark" | "green") : "light"
  const variant = search.get("variant") === "merch" ? "merch" : "badge"
  const shape = isBadgeShape(search.get("shape")) ? (search.get("shape") as BadgeShape) : "wide"

  let data: Awaited<ReturnType<typeof getBadgeData>>
  try {
    data = await getBadgeData(handle)
  } catch {
    return new NextResponse("Badge unavailable", { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  if (!data) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } })

  let metric: BadgeMetric = isBadgeMetric(requestedMetric) ? requestedMetric : "mrr"
  if (metric !== "verified" && !data.amounts[metric]) metric = "verified"
  const amount = metric === "verified" ? null : (data.amounts[metric] ?? null)

  const svg =
    variant === "merch"
      ? (() => {
          const profileUrl = `${SITE_URL}/@${data.handle}`
          const qr = search.get("qr") === "0" ? null : qrMatrix(profileUrl)
          if (search.get("layout") === "chest") {
            return buildChestSvg({ handle: data.handle, amount, metric, onDark: search.get("tone") === "dark", asOf: data.asOf, profileUrl, qr })
          }
          return buildMerchSvg({ handle: data.handle, amount, metric, theme, asOf: data.asOf, profileUrl, qr })
        })()
      : shape === "stacked"
        ? buildStackedBadgeSvg({ handle: data.handle, amount, metric, theme })
        : buildBadgeSvg({ handle: data.handle, amount, metric, theme })

  const headers: Record<string, string> = { ...SECURITY_HEADERS }
  if (search.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="epicli-${data.handle}-${variant === "badge" ? shape : variant}-${metric}-${theme}.svg"`
  }
  return new NextResponse(svg, { status: 200, headers })
}
