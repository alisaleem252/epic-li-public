import "server-only"

import Stripe from "stripe"

export function createStripeClient(restrictedKey: string) {
  return new Stripe(restrictedKey, {
    apiVersion: "2026-09-30.endive",
    maxNetworkRetries: 0,
    timeout: 8_000,
  })
}
