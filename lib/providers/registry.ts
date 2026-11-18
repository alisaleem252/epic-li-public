export type RevenueProviderId =
  | "lemon_squeezy"
  | "polar"
  | "dodo_payments"
  | "paddle"
  | "revenuecat"
  | "superwall"
  | "app_store_connect"
  | "creem"
  | "whop"
  | "razorpay"

export type RevenueSourceId = "stripe" | RevenueProviderId

export type ProviderMetricCapabilities = {
  revenue: boolean
  chargeCount: boolean
  activeSubscriptions: boolean
  mrr: boolean
  revenueLabel: string
  chargeCountLabel: string
}

export type ProviderCredentialField = {
  key: string
  label: string
  inputType: "text" | "password" | "textarea"
  secret: boolean
  maxLength: number
  placeholder: string
  helperText: string
  optional?: boolean
}

export type ProviderDefinition = {
  id: RevenueProviderId
  name: string
  shortDescription: string
  docsUrl: string
  setupSteps: readonly string[]
  permissionsNote: string
  fields: readonly ProviderCredentialField[]
  metrics: ProviderMetricCapabilities
}

export const REVENUE_PROVIDER_IDS = [
  "lemon_squeezy",
  "polar",
  "dodo_payments",
  "paddle",
  "revenuecat",
  "superwall",
  "app_store_connect",
  "creem",
  "whop",
  "razorpay",
] as const satisfies readonly RevenueProviderId[]

const completeMetrics = (revenueLabel = "Gross charges"): ProviderMetricCapabilities => ({
  revenue: true,
  chargeCount: true,
  activeSubscriptions: true,
  mrr: true,
  revenueLabel,
  chargeCountLabel: "Successful charges",
})

export const PROVIDER_DEFINITIONS: Record<RevenueProviderId, ProviderDefinition> = {
  lemon_squeezy: {
    id: "lemon_squeezy",
    name: "Lemon Squeezy",
    shortDescription: "Store revenue and subscriptions",
    docsUrl: "https://app.lemonsqueezy.com/settings/api",
    setupSteps: [
      "Open API Keys and create a key for the live store.",
      "Choose an expiration that fits your rotation policy; the supplied setup checklist recommends 10+ years for uninterrupted refresh.",
      "Paste the API key below. epic.li uses it only for read requests.",
    ],
    permissionsNote: "Lemon Squeezy API keys do not provide per-endpoint scopes. Revoke or rotate the key in the dashboard at any time.",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the live API key",
        helperText: "The key is sent to the server over HTTPS and encrypted before storage.",
      },
      {
        key: "storeId",
        label: "Store ID (optional)",
        inputType: "text",
        secret: false,
        optional: true,
        maxLength: 64,
        placeholder: "Leave blank to use the first accessible store",
        helperText: "Use this when the key can access more than one store.",
      },
    ],
    metrics: completeMetrics(),
  },
  polar: {
    id: "polar",
    name: "Polar",
    shortDescription: "Organization orders and subscriptions",
    docsUrl: "https://polar.sh/dashboard",
    setupSteps: [
      "Open Settings, then General, and create an Organization Access Token.",
      "Select No expiration if you need uninterrupted refresh.",
      "Grant orders:read, subscriptions:read, organizations:read, and products:read. The products scope is required to read the catalog.",
      "Paste the token below.",
    ],
    permissionsNote: "Use read-only scopes only. No product, subscription, or payment write scope is needed.",
    fields: [
      {
        key: "organizationToken",
        label: "Organization Access Token",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "polar_oat_…",
        helperText: "Use an Organization Access Token with the listed read scopes.",
      },
      {
        key: "organizationId",
        label: "Organization ID (optional)",
        inputType: "text",
        secret: false,
        optional: true,
        maxLength: 128,
        placeholder: "Leave blank to use the first accessible organization",
        helperText: "Only needed when the token can access multiple organizations.",
      },
    ],
    metrics: completeMetrics(),
  },
  dodo_payments: {
    id: "dodo_payments",
    name: "Dodo Payments",
    shortDescription: "Payments, subscriptions, and products",
    docsUrl: "https://app.dodopayments.com/developer/api-keys",
    setupSteps: [
      "Open the Dodo Payments developer settings and create a live read-only API key.",
      "Copy the key and paste it below.",
    ],
    permissionsNote: "Use a read-only key. epic.li calls the live payments, subscriptions, and products endpoints only.",
    fields: [
      {
        key: "apiKey",
        label: "Live API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the read-only live key",
        helperText: "Test-mode keys are not accepted for public revenue profiles.",
      },
    ],
    metrics: completeMetrics(),
  },
  paddle: {
    id: "paddle",
    name: "Paddle Billing",
    shortDescription: "Transactions, subscriptions, and catalog",
    docsUrl: "https://vendors.paddle.com/authentication-v2",
    setupSteps: [
      "Open Developer Tools, then Authentication, and create a live API key.",
      "Enable Read for Customer, Product, Subscription, and Transaction.",
      "Paste the API key below.",
    ],
    permissionsNote: "Only the four read permissions above are required. Product read includes the associated price catalog.",
    fields: [
      {
        key: "apiKey",
        label: "Live API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the live API key",
        helperText: "Use a live key with only the requested read permissions.",
      },
    ],
    metrics: completeMetrics(),
  },
  revenuecat: {
    id: "revenuecat",
    name: "RevenueCat",
    shortDescription: "Project revenue, MRR, and products",
    docsUrl: "https://app.revenuecat.com/",
    setupSteps: [
      "Open the API Keys tab and create a V2 secret API key.",
      "Set Projects Configuration and Charts Configuration to Read only.",
      "Paste the V2 secret key below. The first accessible project is used.",
    ],
    permissionsNote: "The connection reads project configuration, product catalog, revenue, MRR, and active-subscription charts. It does not read customer records.",
    fields: [
      {
        key: "apiKey",
        label: "V2 secret API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the V2 secret key",
        helperText: "V1 keys are not accepted by the RevenueCat V2 API.",
      },
      {
        key: "projectId",
        label: "Project ID (optional)",
        inputType: "text",
        secret: false,
        optional: true,
        maxLength: 128,
        placeholder: "Leave blank to use the first accessible project",
        helperText: "Use this when the API key can access more than one project.",
      },
    ],
    metrics: {
      revenue: true,
      chargeCount: false,
      activeSubscriptions: true,
      mrr: true,
      revenueLabel: "30-day revenue",
      chargeCountLabel: "Transactions",
    },
  },
  superwall: {
    id: "superwall",
    name: "Superwall",
    shortDescription: "Attributed in-app revenue and product IDs",
    docsUrl: "https://superwall.com/applications/",
    setupSteps: [
      "Create an organization API key in the Superwall dashboard.",
      "Enable the data:read scope (or the equivalent read-only data access shown in your dashboard).",
      "Copy the organization ID from the dashboard and paste it with the key below.",
    ],
    permissionsNote: "This connection reads the attributed events table and product identifiers only. Superwall's event dataset does not provide normalized active-subscription or MRR totals, so those public metrics are shown as unavailable.",
    fields: [
      {
        key: "organizationId",
        label: "Organization ID",
        inputType: "text",
        secret: false,
        maxLength: 128,
        placeholder: "Your Superwall organization ID",
        helperText: "Used only in the fixed Superwall Query API path.",
      },
      {
        key: "organizationApiKey",
        label: "Organization API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the read-only organization key",
        helperText: "The key is sent only in the Authorization header to Superwall.",
      },
    ],
    metrics: {
      revenue: true,
      chargeCount: true,
      activeSubscriptions: false,
      mrr: false,
      revenueLabel: "Attributed revenue",
      chargeCountLabel: "Attributed events",
    },
  },
  app_store_connect: {
    id: "app_store_connect",
    name: "App Store Connect",
    shortDescription: "Subscription sales reports and SKUs",
    docsUrl: "https://appstoreconnect.apple.com/access/integrations/api",
    setupSteps: [
      "Create a Team API Key with Sales and Reports access.",
      "Download the .p8 private key once, then copy the Issuer ID, Key ID, and vendor number.",
      "Paste the identifiers and private key below. The key is used server-side to sign short-lived Apple API tokens.",
    ],
    permissionsNote: "The Sales and Reports API provides reported proceeds and sold subscription SKUs, but not point-in-time MRR or active-subscription totals. Those metrics are shown as unavailable.",
    fields: [
      {
        key: "issuerId",
        label: "Issuer ID",
        inputType: "text",
        secret: false,
        maxLength: 128,
        placeholder: "App Store Connect issuer ID",
        helperText: "Found in Users and Access → Integrations → App Store Connect API.",
      },
      {
        key: "keyId",
        label: "Key ID",
        inputType: "text",
        secret: false,
        maxLength: 64,
        placeholder: "App Store Connect key ID",
        helperText: "The key must have Sales and Reports access.",
      },
      {
        key: "vendorNumber",
        label: "Vendor number",
        inputType: "text",
        secret: false,
        maxLength: 32,
        placeholder: "Numeric vendor number",
        helperText: "Shown in Payments and Financial Reports in App Store Connect.",
      },
      {
        key: "privateKey",
        label: "Team API private key (.p8)",
        inputType: "textarea",
        secret: true,
        maxLength: 8192,
        placeholder: "-----BEGIN PRIVATE KEY-----",
        helperText: "Paste the full PEM contents of the downloaded .p8 file.",
      },
    ],
    metrics: {
      revenue: true,
      chargeCount: true,
      activeSubscriptions: false,
      mrr: false,
      revenueLabel: "Developer proceeds",
      chargeCountLabel: "Reported units",
    },
  },
  creem: {
    id: "creem",
    name: "Creem",
    shortDescription: "Transactions, subscriptions, and products",
    docsUrl: "https://creem.io/dashboard/developers",
    setupSteps: [
      "Open the Developer section and create a Production API key.",
      "Enable read access for products, transactions, and subscriptions.",
      "Paste the production key below.",
    ],
    permissionsNote: "Use read scopes only. The key is sent in the x-api-key header to Creem's production API.",
    fields: [
      {
        key: "apiKey",
        label: "Production API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the production key",
        helperText: "Do not use a test-mode key for a public revenue profile.",
      },
    ],
    metrics: completeMetrics(),
  },
  whop: {
    id: "whop",
    name: "Whop",
    shortDescription: "Company products, memberships, and payments",
    docsUrl: "https://whop.com/dashboard/developer",
    setupSteps: [
      "Create a Company API Key and grant only the read scopes required for products, plans, and payments: access_pass:basic:read, plan:basic:read, payment:basic:read, member:basic:read, member:email:read, member:phone:read, promo_code:basic:read, and shipment:basic:read.",
      "If the dashboard requires inheriting a role, choose the least-privileged role that grants those read scopes. Copy the company ID (biz_…) and key below.",
      "The integration uses Whop API v1. Payment responses may contain customer fields, but epic.li only processes aggregate amounts, statuses, dates, and currencies; raw payment or member records are never stored.",
    ],
    permissionsNote: "Whop's payments read endpoint requires additional member, promo-code, and shipment read scopes. epic.li sends read-only requests and never stores or displays those customer fields or raw payment records.",
    fields: [
      {
        key: "accountId",
        label: "Company ID",
        inputType: "text",
        secret: false,
        maxLength: 128,
        placeholder: "biz_…",
        helperText: "This scopes product, membership, and payment requests to your company.",
      },
      {
        key: "apiKey",
        label: "Company API key",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the read-only company key",
        helperText: "The key is sent in the Authorization header to Whop.",
      },
    ],
    metrics: completeMetrics(),
  },
  razorpay: {
    id: "razorpay",
    name: "Razorpay",
    shortDescription: "Captured payments, subscriptions, and plans",
    docsUrl: "https://dashboard.razorpay.com/app/website-app-settings/api-keys",
    setupSteps: [
      "Switch to Live Mode and open Account & Settings → API Keys.",
      "Copy the live Key ID and the saved Key Secret.",
      "Paste both values below and keep the credentials active for refreshes.",
    ],
    permissionsNote: "epic.li calls Razorpay's read endpoints for payments, subscriptions, plans, and items. It never creates or modifies Razorpay objects.",
    fields: [
      {
        key: "keyId",
        label: "Live Key ID",
        inputType: "text",
        secret: false,
        maxLength: 128,
        placeholder: "rzp_live_…",
        helperText: "Use the live Key ID, not a test-mode key.",
      },
      {
        key: "keySecret",
        label: "Live Key Secret",
        inputType: "password",
        secret: true,
        maxLength: 4096,
        placeholder: "Paste the saved live Key Secret",
        helperText: "The secret is encrypted before storage and never returned to the browser.",
      },
    ],
    metrics: completeMetrics(),
  },
}

const STRIPE_SOURCE = {
  id: "stripe" as const,
  name: "Stripe",
  shortDescription: "Restricted-key revenue and catalog",
  metrics: completeMetrics("30-day successful charges"),
}

export const REVENUE_SOURCE_OPTIONS = [
  STRIPE_SOURCE,
  ...REVENUE_PROVIDER_IDS.map((id) => {
    const definition = PROVIDER_DEFINITIONS[id]
    return {
      id: definition.id,
      name: definition.name,
      shortDescription: definition.shortDescription,
      metrics: definition.metrics,
    }
  }),
] satisfies Array<{
  id: RevenueSourceId
  name: string
  shortDescription: string
  metrics: ProviderMetricCapabilities
}>

export function isRevenueProviderId(value: unknown): value is RevenueProviderId {
  return typeof value === "string" && REVENUE_PROVIDER_IDS.includes(value as RevenueProviderId)
}

export function getProviderDefinition(providerId: RevenueProviderId) {
  return PROVIDER_DEFINITIONS[providerId]
}

export function getRevenueSourceName(sourceId: RevenueSourceId) {
  return sourceId === "stripe" ? STRIPE_SOURCE.name : PROVIDER_DEFINITIONS[sourceId].name
}

export function getRevenueSourceMetrics(sourceId: RevenueSourceId) {
  return sourceId === "stripe" ? STRIPE_SOURCE.metrics : PROVIDER_DEFINITIONS[sourceId].metrics
}
