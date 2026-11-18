import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { paymentProviderCatalogItems, stripePlans, stripeProducts } from "@/lib/db/schema"
import type { RevenueSourceId } from "@/lib/providers/registry"

export const MAX_CATALOG_ITEMS = 200

export type OwnerCatalogItem = {
  kind: "product" | "plan"
  id: string
  name: string
  detail: string | null
  isPublic: boolean
}

function interval(amountInterval: string | null, count: number) {
  return amountInterval ? `Every ${count} ${amountInterval}${count > 1 ? "s" : ""}` : null
}

/** Every active catalog item for the owner, including ones currently hidden from the public page. */
export async function getOwnerCatalog(profileId: string, sourceId: RevenueSourceId): Promise<OwnerCatalogItem[]> {
  if (sourceId === "stripe") {
    const [products, plans] = await Promise.all([
      db
        .select({ id: stripeProducts.stripeProductId, name: stripeProducts.name, isPublic: stripeProducts.isPublic })
        .from(stripeProducts)
        .where(and(eq(stripeProducts.profileId, profileId), eq(stripeProducts.active, true)))
        .orderBy(stripeProducts.name)
        .limit(MAX_CATALOG_ITEMS),
      db
        .select({
          id: stripePlans.stripePlanId,
          name: stripePlans.nickname,
          billingInterval: stripePlans.billingInterval,
          intervalCount: stripePlans.intervalCount,
          isPublic: stripePlans.isPublic,
        })
        .from(stripePlans)
        .where(and(eq(stripePlans.profileId, profileId), eq(stripePlans.active, true)))
        .orderBy(stripePlans.amountMinor)
        .limit(MAX_CATALOG_ITEMS),
    ])
    return [
      ...products.map((p) => ({ kind: "product" as const, id: p.id, name: p.name, detail: null, isPublic: p.isPublic })),
      ...plans.map((p) => ({
        kind: "plan" as const,
        id: p.id,
        name: p.name || p.id,
        detail: interval(p.billingInterval, p.intervalCount),
        isPublic: p.isPublic,
      })),
    ]
  }

  const rows = await db
    .select({
      kind: paymentProviderCatalogItems.itemKind,
      id: paymentProviderCatalogItems.externalId,
      name: paymentProviderCatalogItems.name,
      billingInterval: paymentProviderCatalogItems.billingInterval,
      intervalCount: paymentProviderCatalogItems.intervalCount,
      isPublic: paymentProviderCatalogItems.isPublic,
    })
    .from(paymentProviderCatalogItems)
    .where(
      and(
        eq(paymentProviderCatalogItems.profileId, profileId),
        eq(paymentProviderCatalogItems.provider, sourceId),
        eq(paymentProviderCatalogItems.active, true),
      ),
    )
    .orderBy(paymentProviderCatalogItems.itemKind, paymentProviderCatalogItems.name)
    .limit(MAX_CATALOG_ITEMS * 2)
  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    name: row.name,
    detail: interval(row.billingInterval, row.intervalCount),
    isPublic: row.isPublic,
  }))
}

/** Hides exactly the listed items and shows everything else. Resyncs never touch this flag. */
export async function setCatalogVisibility(
  profileId: string,
  sourceId: RevenueSourceId,
  hidden: { products: string[]; plans: string[] },
) {
  await db.transaction(async (tx) => {
    if (sourceId === "stripe") {
      await tx.update(stripeProducts).set({ isPublic: true }).where(eq(stripeProducts.profileId, profileId))
      await tx.update(stripePlans).set({ isPublic: true }).where(eq(stripePlans.profileId, profileId))
      if (hidden.products.length > 0) {
        await tx
          .update(stripeProducts)
          .set({ isPublic: false })
          .where(and(eq(stripeProducts.profileId, profileId), inArray(stripeProducts.stripeProductId, hidden.products)))
      }
      if (hidden.plans.length > 0) {
        await tx
          .update(stripePlans)
          .set({ isPublic: false })
          .where(and(eq(stripePlans.profileId, profileId), inArray(stripePlans.stripePlanId, hidden.plans)))
      }
      return
    }

    const scope = and(
      eq(paymentProviderCatalogItems.profileId, profileId),
      eq(paymentProviderCatalogItems.provider, sourceId),
    )
    await tx.update(paymentProviderCatalogItems).set({ isPublic: true }).where(scope)
    for (const [kind, ids] of [["product", hidden.products], ["plan", hidden.plans]] as const) {
      if (ids.length === 0) continue
      await tx
        .update(paymentProviderCatalogItems)
        .set({ isPublic: false })
        .where(
          and(scope, eq(paymentProviderCatalogItems.itemKind, kind), inArray(paymentProviderCatalogItems.externalId, ids)),
        )
    }
  })
}
