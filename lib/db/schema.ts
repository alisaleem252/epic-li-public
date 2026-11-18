import { sql } from "drizzle-orm"
import type { ProfileSocialLinks } from "@/lib/profile-links"
import type { RevenueProviderId } from "@/lib/providers/registry"
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export type ProfileStatus = "draft" | "published" | "suspended"
export type StripeConnectionStatus =
  | "pending"
  | "capabilities_passed"
  | "needs_attention"
  | "revoked"
export type StripeVerificationStatus =
  | "capabilities_passed"
  | "capabilities_failed"
  | "awaiting_dashboard_review"
  | "dashboard_review_confirmed"

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: varchar("handle", { length: 32 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    bio: varchar("bio", { length: 280 }).notNull().default(""),
    contactEmail: varchar("contact_email", { length: 254 }),
    websiteUrl: text("website_url"),
    appUrl: text("app_url"),
    socialLinks: jsonb("social_links")
      .$type<ProfileSocialLinks>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").$type<ProfileStatus>().notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    featureOnHomepage: boolean("feature_on_homepage").notNull().default(false),
    showcaseReviewedAt: timestamp("showcase_reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("profiles_handle_key").on(table.handle),
    check(
      "profiles_handle_format_check",
      sql`${table.handle} ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'`,
    ),
    check(
      "profiles_status_check",
      sql`${table.status} in ('draft', 'published', 'suspended')`,
    ),
    check(
      "profiles_social_links_object_check",
      sql`jsonb_typeof(${table.socialLinks}) = 'object'`,
    ),
  ],
)

export const stripeConnections = pgTable(
  "stripe_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    encryptionIv: text("encryption_iv").notNull(),
    encryptionVersion: smallint("encryption_version").notNull().default(1),
    keyMode: text("key_mode").$type<"test" | "live">().notNull(),
    status: text("status").$type<StripeConnectionStatus>().notNull().default("pending"),
    capabilityProbeResults: jsonb("capability_probe_results")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    dashboardScopeReviewedAt: timestamp("dashboard_scope_reviewed_at", {
      withTimezone: true,
    }),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_connections_profile_id_key").on(table.profileId),
    check("stripe_connections_encryption_version_check", sql`${table.encryptionVersion} > 0`),
    check(
      "stripe_connections_key_mode_check",
      sql`${table.keyMode} in ('test', 'live')`,
    ),
    check(
      "stripe_connections_status_check",
      sql`${table.status} in ('pending', 'capabilities_passed', 'needs_attention', 'revoked')`,
    ),
    check(
      "stripe_connections_capability_probe_results_check",
      sql`jsonb_typeof(${table.capabilityProbeResults}) = 'object'`,
    ),
  ],
)

export const stripeVerificationRuns = pgTable(
  "stripe_verification_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    status: text("status").$type<StripeVerificationStatus>().notNull(),
    capabilityResults: jsonb("capability_results")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    dashboardScopeConfirmed: boolean("dashboard_scope_confirmed").notNull().default(false),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("stripe_verification_runs_profile_started_idx").on(
      table.profileId,
      table.startedAt.desc(),
    ),
    check(
      "stripe_verification_runs_status_check",
      sql`${table.status} in ('capabilities_passed', 'capabilities_failed', 'awaiting_dashboard_review', 'dashboard_review_confirmed')`,
    ),
    check(
      "stripe_verification_runs_capability_results_check",
      sql`jsonb_typeof(${table.capabilityResults}) = 'object'`,
    ),
  ],
)

export const revenueSnapshots = pgTable(
  "revenue_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    grossChargeAmountMinor: bigint("gross_charge_amount_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    refundedAmountMinor: bigint("refunded_amount_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    successfulChargeCount: integer("successful_charge_count").notNull().default(0),
    activeSubscriptionCount: integer("active_subscription_count").notNull().default(0),
    mrrMinor: bigint("mrr_minor", { mode: "bigint" }).notNull().default(sql`0`),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("revenue_snapshots_profile_period_currency_unique").on(
      table.profileId,
      table.periodStart,
      table.periodEnd,
      table.currency,
    ),
    index("revenue_snapshots_profile_recorded_idx").on(
      table.profileId,
      table.recordedAt.desc(),
    ),
    check("revenue_snapshots_period_check", sql`${table.periodStart} <= ${table.periodEnd}`),
    check("revenue_snapshots_currency_check", sql`${table.currency} ~ '^[a-z]{3}$'`),
    check(
      "revenue_snapshots_gross_charge_amount_minor_check",
      sql`${table.grossChargeAmountMinor} >= 0`,
    ),
    check(
      "revenue_snapshots_refunded_amount_minor_check",
      sql`${table.refundedAmountMinor} >= 0`,
    ),
    check(
      "revenue_snapshots_successful_charge_count_check",
      sql`${table.successfulChargeCount} >= 0`,
    ),
    check(
      "revenue_snapshots_active_subscription_count_check",
      sql`${table.activeSubscriptionCount} >= 0`,
    ),
    check("revenue_snapshots_mrr_minor_check", sql`${table.mrrMinor} >= 0`),
  ],
)

export const stripeProducts = pgTable(
  "stripe_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    stripeProductId: varchar("stripe_product_id", { length: 128 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    active: boolean("active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_products_profile_stripe_id_unique").on(
      table.profileId,
      table.stripeProductId,
    ),
    index("stripe_products_profile_active_name_idx").on(
      table.profileId,
      table.active,
      table.name,
    ),
  ],
)

export const stripePlans = pgTable(
  "stripe_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    stripePlanId: varchar("stripe_plan_id", { length: 128 }).notNull(),
    stripeProductId: varchar("stripe_product_id", { length: 128 }),
    nickname: varchar("nickname", { length: 200 }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    billingInterval: text("billing_interval")
      .$type<"day" | "week" | "month" | "year">()
      .notNull(),
    intervalCount: smallint("interval_count").notNull().default(1),
    active: boolean("active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_plans_profile_stripe_id_unique").on(
      table.profileId,
      table.stripePlanId,
    ),
    index("stripe_plans_profile_active_amount_idx").on(
      table.profileId,
      table.active,
      table.amountMinor,
    ),
    check("stripe_plans_amount_minor_check", sql`${table.amountMinor} >= 0`),
    check("stripe_plans_currency_check", sql`${table.currency} ~ '^[a-z]{3}$'`),
    check(
      "stripe_plans_billing_interval_check",
      sql`${table.billingInterval} in ('day', 'week', 'month', 'year')`,
    ),
    check("stripe_plans_interval_count_check", sql`${table.intervalCount} > 0`),
  ],
)

export const paymentProviderConnections = pgTable(
  "payment_provider_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    provider: text("provider").$type<RevenueProviderId>().notNull(),
    encryptedCredentials: text("encrypted_credentials").notNull(),
    encryptionIv: text("encryption_iv").notNull(),
    encryptionVersion: smallint("encryption_version").notNull().default(1),
    status: text("status").$type<"connected" | "needs_attention" | "revoked">().notNull().default("connected"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_provider_connections_profile_id_key").on(table.profileId),
    check("payment_provider_connections_encryption_version_check", sql`${table.encryptionVersion} > 0`),
    check(
      "payment_provider_connections_provider_check",
      sql`${table.provider} in ('lemon_squeezy', 'polar', 'dodo_payments', 'paddle', 'revenuecat', 'superwall', 'app_store_connect', 'creem', 'whop', 'razorpay')`,
    ),
    check(
      "payment_provider_connections_status_check",
      sql`${table.status} in ('connected', 'needs_attention', 'revoked')`,
    ),
  ],
)

export const providerPayloadSnapshots = pgTable(
  "provider_payload_snapshots",
  {
    profileId: uuid("profile_id").primaryKey(),
    provider: text("provider").$type<RevenueProviderId | "stripe">().notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    encryptionIv: text("encryption_iv").notNull(),
    encryptionVersion: smallint("encryption_version").notNull().default(1),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "provider_payload_snapshots_provider_check",
      sql`${table.provider} in ('stripe', 'lemon_squeezy', 'polar', 'dodo_payments', 'paddle', 'revenuecat', 'superwall', 'app_store_connect', 'creem', 'whop', 'razorpay')`,
    ),
    check(
      "provider_payload_snapshots_encryption_version_check",
      sql`${table.encryptionVersion} > 0`,
    ),
  ],
)

export const profileChargeEvents = pgTable(
  "profile_charge_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    chargeId: varchar("charge_id", { length: 128 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountCapturedMinor: bigint("amount_captured_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    isRecurring: boolean("is_recurring").notNull().default(false),
    customerHash: varchar("customer_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_charge_events_profile_charge_unique").on(
      table.profileId,
      table.chargeId,
    ),
    index("profile_charge_events_profile_occurred_idx").on(
      table.profileId,
      table.occurredAt,
    ),
    check("profile_charge_events_amount_check", sql`${table.amountCapturedMinor} >= 0`),
    check("profile_charge_events_currency_check", sql`${table.currency} ~ '^[a-z]{3}$'`),
    check(
      "profile_charge_events_customer_hash_check",
      sql`${table.customerHash} is null or length(${table.customerHash}) = 64`,
    ),
  ],
)

export const paymentProviderCatalogItems = pgTable(
  "payment_provider_catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    provider: text("provider").$type<RevenueProviderId>().notNull(),
    itemKind: text("item_kind").$type<"product" | "plan">().notNull(),
    externalId: varchar("external_id", { length: 160 }).notNull(),
    productExternalId: varchar("product_external_id", { length: 160 }),
    name: varchar("name", { length: 200 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currency: varchar("currency", { length: 3 }),
    billingInterval: text("billing_interval").$type<"day" | "week" | "month" | "year">(),
    intervalCount: smallint("interval_count").notNull().default(1),
    active: boolean("active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_provider_catalog_items_identity_unique").on(
      table.profileId,
      table.provider,
      table.itemKind,
      table.externalId,
    ),
    index("payment_provider_catalog_profile_active_kind_name_idx").on(
      table.profileId,
      table.active,
      table.itemKind,
      table.name,
    ),
    check(
      "payment_provider_catalog_items_provider_check",
      sql`${table.provider} in ('lemon_squeezy', 'polar', 'dodo_payments', 'paddle', 'revenuecat', 'superwall', 'app_store_connect', 'creem', 'whop', 'razorpay')`,
    ),
    check(
      "payment_provider_catalog_items_kind_check",
      sql`${table.itemKind} in ('product', 'plan')`,
    ),
    check(
      "payment_provider_catalog_items_amount_check",
      sql`${table.amountMinor} is null or ${table.amountMinor} >= 0`,
    ),
    check(
      "payment_provider_catalog_items_currency_check",
      sql`${table.currency} is null or ${table.currency} ~ '^[a-z]{3}$'`,
    ),
    check(
      "payment_provider_catalog_items_interval_check",
      sql`${table.billingInterval} is null or ${table.billingInterval} in ('day', 'week', 'month', 'year')`,
    ),
    check("payment_provider_catalog_items_interval_count_check", sql`${table.intervalCount} > 0`),
  ],
)

export type AudienceSource = "verified" | "self_reported"

export const profileAudience = pgTable(
  "profile_audience",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),
    platform: varchar("platform", { length: 24 }).notNull(),
    followers: bigint("followers", { mode: "bigint" }).notNull(),
    source: text("source").$type<AudienceSource>().notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_audience_profile_platform_unique").on(table.profileId, table.platform),
    check(
      "profile_audience_followers_check",
      sql`${table.followers} >= 0 and ${table.followers} <= 10000000000`,
    ),
    check("profile_audience_source_check", sql`${table.source} in ('verified', 'self_reported')`),
  ],
)
