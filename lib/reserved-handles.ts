/**
 * Handles that cannot be claimed because they are site routes, the project's own
 * name, or payment/platform brands that would invite impersonation.
 *
 * This list covers system and brand names only. It deliberately contains no
 * individual people: handle squatting on real founders is a verification problem,
 * not something a static list can solve fairly.
 *
 * Contributors: add entries in lowercase, using the same format as real handles.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Site routes and system names
  "about",
  "account",
  "admin",
  "api",
  "app",
  "assets",
  "badge",
  "badges",
  "blog",
  "contact",
  "create",
  "dashboard",
  "demo",
  "docs",
  "edit",
  "embed",
  "explore",
  "feed",
  "help",
  "home",
  "leaderboard",
  "legal",
  "login",
  "logout",
  "new",
  "pricing",
  "privacy",
  "profile",
  "profiles",
  "search",
  "security",
  "settings",
  "signin",
  "signup",
  "static",
  "status",
  "support",
  "terms",
  "verify",
  "www",

  // The project itself
  "epic",
  "epic-li",
  "epicli",

  // Supported providers and well-known platforms
  "app-store-connect",
  "appstore",
  "creem",
  "dodo",
  "dodo-payments",
  "github",
  "gumroad",
  "lemon-squeezy",
  "lemonsqueezy",
  "paddle",
  "paypal",
  "polar",
  "razorpay",
  "revenuecat",
  "shopify",
  "stripe",
  "superwall",
  "trustmrr",
  "whop",
])

export function isReservedHandle(handle: string) {
  return RESERVED_HANDLES.has(handle)
}
