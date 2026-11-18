import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { paymentProviderConnections, stripeConnections } from "@/lib/db/schema"
import { parseProviderCredentialProof } from "@/lib/providers/credentials"
import { isRevenueProviderId, type RevenueSourceId } from "@/lib/providers/registry"
import {
  matchesEncryptedProviderCredentialProof,
  matchesEncryptedStripeKey,
} from "@/lib/stripe/crypto"

export type ProfileCredentialProofFailure = {
  ok: false
  status: number
  error: string
  message: string
}

export type ProfileCredentialProofResult =
  | { ok: true; providerId: RevenueSourceId }
  | ProfileCredentialProofFailure

type ProfileCredentialProofInput = {
  requestedProviderId: RevenueSourceId | null
  stripeRestrictedKey: string
  credentials: unknown
}

export async function verifyProfileCredentialProof(
  profileId: string,
  input: ProfileCredentialProofInput,
): Promise<ProfileCredentialProofResult> {
  const [stripeConnection] = await db
    .select({
      encryptedKey: stripeConnections.encryptedKey,
      encryptionIv: stripeConnections.encryptionIv,
      encryptionVersion: stripeConnections.encryptionVersion,
    })
    .from(stripeConnections)
    .where(eq(stripeConnections.profileId, profileId))
    .limit(1)

  if (stripeConnection) {
    if (
      input.stripeRestrictedKey.length > 255 ||
      !/^rk_live_[A-Za-z0-9_]+$/.test(input.stripeRestrictedKey)
    ) {
      return {
        ok: false,
        status: 400,
        error: "invalid_key_format",
        message: "Enter the same active live restricted key used for this profile.",
      }
    }

    const keyMatches = matchesEncryptedStripeKey(
      input.stripeRestrictedKey,
      stripeConnection.encryptedKey,
      stripeConnection.encryptionIv,
      stripeConnection.encryptionVersion,
    )
    if (!keyMatches) {
      return {
        ok: false,
        status: 403,
        error: "key_mismatch",
        message: "That key does not match the restricted key connected to this profile.",
      }
    }

    return { ok: true, providerId: "stripe" }
  }

  const [providerConnection] = await db
    .select({
      provider: paymentProviderConnections.provider,
      encryptedCredentials: paymentProviderConnections.encryptedCredentials,
      encryptionIv: paymentProviderConnections.encryptionIv,
      encryptionVersion: paymentProviderConnections.encryptionVersion,
    })
    .from(paymentProviderConnections)
    .where(eq(paymentProviderConnections.profileId, profileId))
    .limit(1)

  if (!providerConnection || !isRevenueProviderId(providerConnection.provider)) {
    return {
      ok: false,
      status: 404,
      error: "profile_not_found",
      message: "That public profile was not found.",
    }
  }
  if (input.requestedProviderId !== providerConnection.provider) {
    return {
      ok: false,
      status: 400,
      error: "invalid_provider",
      message: "The selected provider does not match this profile.",
    }
  }

  const proof = parseProviderCredentialProof(providerConnection.provider, input.credentials)
  if (!proof) {
    return {
      ok: false,
      status: 400,
      error: "invalid_provider_credentials",
      message: "Enter the same provider secret used for this profile.",
    }
  }

  const credentialMatches = matchesEncryptedProviderCredentialProof(
    providerConnection.provider,
    proof,
    providerConnection.encryptedCredentials,
    providerConnection.encryptionIv,
    providerConnection.encryptionVersion,
  )
  if (!credentialMatches) {
    return {
      ok: false,
      status: 403,
      error: "key_mismatch",
      message: "That provider secret does not match the credentials connected to this profile.",
    }
  }

  return { ok: true, providerId: providerConnection.provider }
}
