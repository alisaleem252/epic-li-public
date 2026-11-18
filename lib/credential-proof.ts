import type { RevenueProviderId } from "@/lib/providers/registry"

export type VerifiedCredentialProof =
  | { stripeRestrictedKey: string }
  | { providerId: RevenueProviderId; credentials: Record<string, string> }
