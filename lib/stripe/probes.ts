import "server-only"

import Stripe from "stripe"

export type ProbeEndpointStatus =
  | "accessible"
  | "permission_denied"
  | "invalid_key"
  | "unavailable"

export type StripeProbeReport = {
  status: "passed" | "missing_permissions" | "invalid_key" | "unavailable"
  missingPermissions: string[]
  results: Record<
    string,
    {
      status: "passed" | "missing_permissions" | "invalid_key" | "unavailable"
      endpoints: Record<string, ProbeEndpointStatus>
    }
  >
}

type EndpointProbe = {
  permission: string
  endpoint: string
  run: (stripe: Stripe) => Promise<unknown>
}

const endpointProbes: EndpointProbe[] = [
  {
    permission: "rak_charge_read",
    endpoint: "charges",
    run: (stripe) => stripe.charges.retrieve("ch_000000000000000000000001"),
  },
  {
    permission: "rak_charge_read",
    endpoint: "refunds",
    run: (stripe) => stripe.refunds.retrieve("re_000000000000000000000001"),
  },
  {
    permission: "rak_subscription_read",
    endpoint: "subscriptions",
    run: (stripe) => stripe.subscriptions.retrieve("sub_000000000000000000000001"),
  },
  {
    permission: "rak_plan_read",
    endpoint: "plans",
    run: (stripe) => stripe.plans.retrieve("plan_000000000000000000000001"),
  },
  {
    permission: "rak_plan_read",
    endpoint: "prices",
    run: (stripe) => stripe.prices.retrieve("price_000000000000000000000001"),
  },
  {
    permission: "rak_product_read",
    endpoint: "products",
    run: (stripe) => stripe.products.retrieve("prod_000000000000000000000001"),
  },
]

function classifyProbeError(error: unknown): ProbeEndpointStatus {
  if (typeof error !== "object" || error === null) return "unavailable"

  const candidate = error as { statusCode?: unknown; code?: unknown }
  const statusCode = typeof candidate.statusCode === "number" ? candidate.statusCode : null
  const code = typeof candidate.code === "string" ? candidate.code : null

  if (statusCode === 404 && code === "resource_missing") return "accessible"
  if (statusCode === 401 || code === "invalid_api_key") return "invalid_key"
  if (
    statusCode === 403 ||
    code === "permission_denied" ||
    code === "insufficient_permissions"
  ) {
    return "permission_denied"
  }

  return "unavailable"
}

export async function probeStripePermissions(stripe: Stripe): Promise<StripeProbeReport> {
  const endpointResults = await Promise.all(
    endpointProbes.map(async (probe) => {
      try {
        await probe.run(stripe)
        return { ...probe, status: "accessible" as const }
      } catch (error) {
        return { ...probe, status: classifyProbeError(error) }
      }
    }),
  )

  const grouped = new Map<string, Record<string, ProbeEndpointStatus>>()
  for (const result of endpointResults) {
    const endpoints = grouped.get(result.permission) ?? {}
    endpoints[result.endpoint] = result.status
    grouped.set(result.permission, endpoints)
  }

  const results: StripeProbeReport["results"] = {}
  for (const [permission, endpoints] of grouped) {
    const statuses = Object.values(endpoints)
    const status = statuses.every((value) => value === "accessible")
      ? "passed"
      : statuses.includes("invalid_key")
        ? "invalid_key"
        : statuses.includes("unavailable")
          ? "unavailable"
          : "missing_permissions"
    results[permission] = { status, endpoints }
  }

  const allStatuses = endpointResults.map((result) => result.status)
  const status: StripeProbeReport["status"] = allStatuses.includes("invalid_key")
    ? "invalid_key"
    : allStatuses.includes("unavailable")
      ? "unavailable"
      : allStatuses.includes("permission_denied")
        ? "missing_permissions"
        : "passed"

  return {
    status,
    missingPermissions: Object.entries(results)
      .filter(([, result]) => result.status === "missing_permissions")
      .map(([permission]) => permission),
    results,
  }
}
