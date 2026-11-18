import "server-only"

import type { ProviderCredentials } from "./credentials"
import type { ProviderSyncResult } from "./metrics"
import type { RevenueProviderId } from "./registry"
import { syncAppStoreConnect } from "./adapters/app-store-connect"
import { syncCreem } from "./adapters/creem"
import { syncDodoPayments } from "./adapters/dodo-payments"
import { syncLemonSqueezy } from "./adapters/lemon-squeezy"
import { syncPaddle } from "./adapters/paddle"
import { syncPolar } from "./adapters/polar"
import { syncRazorpay } from "./adapters/razorpay"
import { syncRevenueCat } from "./adapters/revenuecat"
import { syncSuperwall } from "./adapters/superwall"
import { syncWhop } from "./adapters/whop"
import { captureProviderRawResponses } from "./raw-capture"

const providerAdapters: Record<
  RevenueProviderId,
  (credentials: ProviderCredentials) => Promise<ProviderSyncResult>
> = {
  lemon_squeezy: syncLemonSqueezy,
  polar: syncPolar,
  dodo_payments: syncDodoPayments,
  paddle: syncPaddle,
  revenuecat: syncRevenueCat,
  superwall: syncSuperwall,
  app_store_connect: syncAppStoreConnect,
  creem: syncCreem,
  whop: syncWhop,
  razorpay: syncRazorpay,
}

export async function syncRevenueProvider(
  providerId: RevenueProviderId,
  credentials: ProviderCredentials,
) {
  const { result, responses } = await captureProviderRawResponses(
    () => providerAdapters[providerId](credentials),
  )
  return { ...result, rawResponses: responses }
}
