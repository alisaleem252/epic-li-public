import "server-only"

import { and, count, desc, eq, isNotNull } from "drizzle-orm"
import {
  buildChargeTrajectories,
  MAX_STORED_CHARGES,
  selectTrajectoryCurrency,
  type ChargeTrajectories,
} from "@/lib/charge-trajectories"
import { db } from "@/lib/db"
import { HANDLE_PATTERN } from "@/lib/handle"
import { buildProfileInsights, type ProfileInsights } from "@/lib/profile-insights"
import type { ProfileSocialLinks } from "@/lib/profile-links"
import {
  paymentProviderCatalogItems,
  paymentProviderConnections,
  profileChargeEvents,
  profiles,
  providerPayloadSnapshots,
  revenueSnapshots,
  stripeConnections,
  stripePlans,
  stripeProducts,
} from "@/lib/db/schema"
import {
  getRevenueSourceMetrics,
  getRevenueSourceName,
  isRevenueProviderId,
  type RevenueSourceId,
} from "@/lib/providers/registry"
import { isReservedHandle } from "@/lib/reserved-handles"

export type PublicProfileData = {
  profile: {
    id: string
    handle: string
    displayName: string
    bio: string
    websiteUrl: string | null
    appUrl: string | null
    socialLinks: ProfileSocialLinks
    publishedAt: Date | null
  }
  snapshot: {
    periodStart: string
    periodEnd: string
    currency: string
    grossChargeAmountMinor: bigint
    refundedAmountMinor: bigint
    successfulChargeCount: number
    activeSubscriptionCount: number
    mrrMinor: bigint
    recordedAt: Date
  } | null
  provider: {
    id: RevenueSourceId
    name: string
    metrics: ReturnType<typeof getRevenueSourceMetrics>
    lastFetchedAt: Date | null
  }
  catalogCounts: {
    products: number
    plans: number
  }
  products: Array<{
    id: string
    name: string
    active: boolean
  }>
  plans: Array<{
    id: string
    productId: string | null
    name: string
    amountMinor: bigint | null
    currency: string | null
    billingInterval: "day" | "week" | "month" | "year" | null
    intervalCount: number
    active: boolean
  }>
}

export function normalizeHandle(value: string) {
  let decodedValue: string
  try {
    decodedValue = decodeURIComponent(value.trim())
  } catch {
    return null
  }

  const handle = decodedValue.replace(/^@/, "").toLowerCase()
  return HANDLE_PATTERN.test(handle) ? handle : null
}

export type HandleAvailability =
  | { status: "available" }
  | { status: "reserved" }
  | { status: "invalid" }
  | { status: "taken"; published: boolean }

/**
 * Read-only handle check for the homepage claim field. It reserves nothing and
 * writes nothing: a handle only becomes taken once a profile is created with a
 * verified provider credential.
 */
export async function getHandleAvailability(rawHandle: string): Promise<HandleAvailability> {
  const handle = normalizeHandle(rawHandle)
  if (!handle) return { status: "invalid" }

  const [existing] = await db
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.handle, handle))
    .limit(1)

  if (existing) return { status: "taken", published: existing.status === "published" }
  if (isReservedHandle(handle)) return { status: "reserved" }
  return { status: "available" }
}

/** Newest published profiles whose owners opted in AND reviewed their product list (homepage card). */
export async function getLatestPublishedHandles(limit = 5): Promise<string[]> {
  const rows = await db
    .select({ handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        eq(profiles.status, "published"),
        eq(profiles.featureOnHomepage, true),
        isNotNull(profiles.showcaseReviewedAt),
      ),
    )
    .orderBy(desc(profiles.publishedAt), desc(profiles.createdAt))
    .limit(limit)
  return rows.map((row) => row.handle)
}

export async function getPublicProfile(rawHandle: string): Promise<PublicProfileData | null> {
  const handle = normalizeHandle(rawHandle)
  if (!handle) return null

  const [profile] = await db
    .select({
      id: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
      bio: profiles.bio,
      websiteUrl: profiles.websiteUrl,
      appUrl: profiles.appUrl,
      socialLinks: profiles.socialLinks,
      publishedAt: profiles.publishedAt,
    })
    .from(profiles)
    .where(and(eq(profiles.handle, handle), eq(profiles.status, "published")))
    .limit(1)

  if (!profile) return null

  const [stripeConnectionRows, providerConnectionRows] = await Promise.all([
    db
      .select({
        id: stripeConnections.id,
        lastValidatedAt: stripeConnections.lastValidatedAt,
      })
      .from(stripeConnections)
      .where(eq(stripeConnections.profileId, profile.id))
      .limit(1),
    db
      .select({
        provider: paymentProviderConnections.provider,
        lastSyncedAt: paymentProviderConnections.lastSyncedAt,
      })
      .from(paymentProviderConnections)
      .where(eq(paymentProviderConnections.profileId, profile.id))
      .limit(1),
  ])
  const genericProviderId = providerConnectionRows[0]?.provider
  const sourceId: RevenueSourceId | null = isRevenueProviderId(genericProviderId)
    ? genericProviderId
    : stripeConnectionRows[0]
      ? "stripe"
      : null
  if (!sourceId) return null
  const sourceMetrics = getRevenueSourceMetrics(sourceId)

  const [snapshotRows, payloadSnapshotRows] = await Promise.all([
    db
      .select({
        periodStart: revenueSnapshots.periodStart,
        periodEnd: revenueSnapshots.periodEnd,
        currency: revenueSnapshots.currency,
        grossChargeAmountMinor: revenueSnapshots.grossChargeAmountMinor,
        refundedAmountMinor: revenueSnapshots.refundedAmountMinor,
        successfulChargeCount: revenueSnapshots.successfulChargeCount,
        activeSubscriptionCount: revenueSnapshots.activeSubscriptionCount,
        mrrMinor: revenueSnapshots.mrrMinor,
        recordedAt: revenueSnapshots.recordedAt,
      })
      .from(revenueSnapshots)
      .where(eq(revenueSnapshots.profileId, profile.id))
      .orderBy(desc(revenueSnapshots.periodEnd), desc(revenueSnapshots.recordedAt))
      .limit(1),
    db
      .select({ fetchedAt: providerPayloadSnapshots.fetchedAt })
      .from(providerPayloadSnapshots)
      .where(
        and(
          eq(providerPayloadSnapshots.profileId, profile.id),
          eq(providerPayloadSnapshots.provider, sourceId),
        ),
      )
      .limit(1),
  ])
  const snapshot = snapshotRows[0]
  const lastFetchedAt =
    payloadSnapshotRows[0]?.fetchedAt ??
    (sourceId === "stripe"
      ? stripeConnectionRows[0]?.lastValidatedAt
      : providerConnectionRows[0]?.lastSyncedAt) ??
    snapshot?.recordedAt ??
    null

  let products: PublicProfileData["products"]
  let plans: PublicProfileData["plans"]
  let catalogCounts: PublicProfileData["catalogCounts"]
  if (sourceId === "stripe") {
    const [stripeProductRows, stripePlanRows, [stripeProductCount], [stripePlanCount]] = await Promise.all([
      db
        .select({
          id: stripeProducts.stripeProductId,
          name: stripeProducts.name,
          active: stripeProducts.active,
        })
        .from(stripeProducts)
        .where(and(eq(stripeProducts.profileId, profile.id), eq(stripeProducts.active, true), eq(stripeProducts.isPublic, true)))
        .orderBy(stripeProducts.name)
        .limit(8),
      db
        .select({
          id: stripePlans.stripePlanId,
          productId: stripePlans.stripeProductId,
          name: stripePlans.nickname,
          amountMinor: stripePlans.amountMinor,
          currency: stripePlans.currency,
          billingInterval: stripePlans.billingInterval,
          intervalCount: stripePlans.intervalCount,
          active: stripePlans.active,
        })
        .from(stripePlans)
        .where(and(eq(stripePlans.profileId, profile.id), eq(stripePlans.active, true), eq(stripePlans.isPublic, true)))
        .orderBy(stripePlans.amountMinor)
        .limit(8),
      db
        .select({ value: count() })
        .from(stripeProducts)
        .where(and(eq(stripeProducts.profileId, profile.id), eq(stripeProducts.active, true), eq(stripeProducts.isPublic, true))),
      db
        .select({ value: count() })
        .from(stripePlans)
        .where(and(eq(stripePlans.profileId, profile.id), eq(stripePlans.active, true), eq(stripePlans.isPublic, true))),
    ])
    products = stripeProductRows
    plans = stripePlanRows.map((plan) => ({ ...plan, name: plan.name || plan.id }))
    catalogCounts = {
      products: Number(stripeProductCount?.value ?? 0),
      plans: Number(stripePlanCount?.value ?? 0),
    }
  } else {
    const catalogFilter = and(
      eq(paymentProviderCatalogItems.profileId, profile.id),
      eq(paymentProviderCatalogItems.provider, sourceId),
      eq(paymentProviderCatalogItems.active, true),
      eq(paymentProviderCatalogItems.isPublic, true),
    )
    const [providerProductRows, providerPlanRows, [providerProductCount], [providerPlanCount]] = await Promise.all([
      db
        .select({
          id: paymentProviderCatalogItems.externalId,
          name: paymentProviderCatalogItems.name,
          active: paymentProviderCatalogItems.active,
        })
        .from(paymentProviderCatalogItems)
        .where(and(catalogFilter, eq(paymentProviderCatalogItems.itemKind, "product")))
        .orderBy(paymentProviderCatalogItems.name)
        .limit(8),
      db
        .select({
          id: paymentProviderCatalogItems.externalId,
          productId: paymentProviderCatalogItems.productExternalId,
          name: paymentProviderCatalogItems.name,
          amountMinor: paymentProviderCatalogItems.amountMinor,
          currency: paymentProviderCatalogItems.currency,
          billingInterval: paymentProviderCatalogItems.billingInterval,
          intervalCount: paymentProviderCatalogItems.intervalCount,
          active: paymentProviderCatalogItems.active,
        })
        .from(paymentProviderCatalogItems)
        .where(and(catalogFilter, eq(paymentProviderCatalogItems.itemKind, "plan")))
        .orderBy(paymentProviderCatalogItems.amountMinor)
        .limit(8),
      db
        .select({ value: count() })
        .from(paymentProviderCatalogItems)
        .where(and(catalogFilter, eq(paymentProviderCatalogItems.itemKind, "product"))),
      db
        .select({ value: count() })
        .from(paymentProviderCatalogItems)
        .where(and(catalogFilter, eq(paymentProviderCatalogItems.itemKind, "plan"))),
    ])
    products = providerProductRows
    plans = providerPlanRows
    catalogCounts = {
      products: Number(providerProductCount?.value ?? 0),
      plans: Number(providerPlanCount?.value ?? 0),
    }
  }

  return {
    profile,
    provider: {
      id: sourceId,
      name: getRevenueSourceName(sourceId),
      metrics: sourceMetrics,
      lastFetchedAt,
    },
    snapshot: snapshot ?? null,
    catalogCounts,
    products,
    plans,
  }
}

export type ProfileCharts = {
  trajectories: ChargeTrajectories
  insights: ProfileInsights
}

/** One query for the dated charge facts; both the trajectory chart and the insight charts derive from it. */
export async function getProfileCharts(
  profileId: string,
  preferredCurrency: string | null,
): Promise<ProfileCharts> {
  const events = await db
    .select({
      occurredAt: profileChargeEvents.occurredAt,
      currency: profileChargeEvents.currency,
      amountCapturedMinor: profileChargeEvents.amountCapturedMinor,
      isRecurring: profileChargeEvents.isRecurring,
      customerHash: profileChargeEvents.customerHash,
    })
    .from(profileChargeEvents)
    .where(eq(profileChargeEvents.profileId, profileId))
    .orderBy(profileChargeEvents.occurredAt)
    .limit(MAX_STORED_CHARGES)

  const currency = selectTrajectoryCurrency(events, preferredCurrency)

  return {
    trajectories: {
      currency,
      series: buildChargeTrajectories(events, currency),
      eventCount: events.length,
      truncated: events.length >= MAX_STORED_CHARGES,
    },
    insights: buildProfileInsights(events, currency),
  }
}
