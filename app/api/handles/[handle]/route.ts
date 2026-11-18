import { ipAddress } from "@vercel/functions"
import { NextResponse, type NextRequest } from "next/server"
import { getHandleAvailability } from "@/lib/profiles"
import { limitHandleCheck } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ handle: string }>
}

function jsonResponse(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  })
}

/**
 * Read-only availability check for the homepage claim field.
 * Reserves nothing and writes nothing; see `getHandleAvailability`.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  let rateLimit: Awaited<ReturnType<typeof limitHandleCheck>>
  try {
    rateLimit = await limitHandleCheck(ipAddress(request) ?? "unknown-client")
  } catch {
    return jsonResponse({ status: "unavailable" }, 503)
  }

  if (!rateLimit.success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000))
    return jsonResponse({ status: "rate_limited", retryAfterSeconds }, 429, {
      "Retry-After": String(retryAfterSeconds),
    })
  }

  const { handle } = await params

  try {
    return jsonResponse({ ...(await getHandleAvailability(handle)) }, 200)
  } catch {
    return jsonResponse({ status: "unavailable" }, 503)
  }
}
