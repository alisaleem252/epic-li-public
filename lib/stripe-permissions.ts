export const STRIPE_RESTRICTED_KEY_URL =
  "https://dashboard.stripe.com/apikeys/create?name=Epic.li&permissions%5B%5D=rak_charge_read&permissions%5B%5D=rak_subscription_read&permissions%5B%5D=rak_plan_read&permissions%5B%5D=rak_product_read"

export const REQUIRED_STRIPE_PERMISSIONS = [
  { key: "rak_charge_read", label: "Charges and refunds" },
  { key: "rak_subscription_read", label: "Subscriptions" },
  { key: "rak_plan_read", label: "Plans and prices" },
  { key: "rak_product_read", label: "Products" },
] as const

export const STRIPE_PERMISSION_AUDIT_NOTICE =
  "Stripe does not expose a restricted key's complete grant list through its API. Endpoint probes confirm access only. Before publishing, the owner must review the complete key in Stripe Dashboard and attest that only these four read permissions are enabled."

export const STRIPE_CHARGE_DATA_NOTICE =
  "Only charge/refund, subscription, plan/price, and product reads are requested. Connect-account and Files access are deliberately excluded; set them to None on an existing key or create a new key from this updated preset. Stripe responses can include billing or contact metadata; epic.li encrypts raw responses server-side and publishes aggregate metrics and public catalog labels only."

export const STRIPE_SETUP_STEPS = [
  "Click this box. Stripe opens with a restricted key pre-filled with four read permissions.",
  "Confirm the four permissions are set to Read and everything else is None, then click Create key.",
  "Copy the rk_live_ key. Stripe shows it only once.",
  "Come back and paste it below.",
] as const
