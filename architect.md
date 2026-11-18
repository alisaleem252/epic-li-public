# epic.li Architecture

> This document describes the repository and connected Neon database as they exist on 2026-11-02. It is based on the current source tree and a live schema inventory; it does not assume undocumented migration history.

## 1. Product overview

epic.li creates shareable public revenue profiles from a connected payment or app-store provider. A profile has a public handle and profile details, plus a provider-backed snapshot of aggregate revenue metrics and public catalog labels. It does not require a user account or password: editing is authorized by proving possession of the same provider credential used to create the profile.

The browser never receives stored provider credentials. The server uses credentials for read-only calls and stores both credentials and the latest raw response payload encrypted. Public profile responses expose only profile fields, aggregate snapshots, selected product/plan data, and the last-fetched timestamp; the raw provider payload is returned to the edit form only after the owner proves possession of the original credential.

## 2. Technology stack

| Area | Technology | Role |
| --- | --- | --- |
| Web framework | Next.js 16.4.3 App Router | Pages, React Server Components, route handlers, metadata, caching |
| UI | React 19.2.4, TypeScript 5.7.3 | Server-rendered pages and typed client forms |
| Styling | Tailwind CSS 4.3.3, `tw-animate-css`, shadcn | Utility styling, design tokens, local accessible UI primitives |
| UI primitives | `@base-ui/react`, local `components/ui` | Fields, buttons, cards, charts, checkboxes, inputs, and related controls |
| Charts and icons | Recharts 3.8.0, Lucide React | Revenue chart and interface icons |
| Database | Neon PostgreSQL, `pg` 8.23.1, Drizzle ORM 0.45.4 | Server-side database connection and typed SQL queries |
| Stripe API | `stripe` 23.x | Read-only calls using each profile owner’s restricted key; pinned to API version `2026-09-30.endive`, 8-second timeout, and zero retries; not Stripe Checkout or app billing |
| Other provider APIs | Server-side `fetch` adapters | Read-only integrations for the supported payment and app-store sources |
| Rate limiting | Upstash Redis REST + `@upstash/ratelimit` | IP-based create/edit throttling |
| Hosting/runtime helpers | Vercel, `@vercel/functions`, `@vercel/analytics` | Database pool lifecycle, client IP extraction, production analytics |
| Package manager | pnpm 12.3.4 | Dependency and lockfile management |

The project uses server-only modules for database access, credential encryption, provider adapters, and Stripe operations. Client components are limited to interactive forms and the chart.

## 3. Repository structure

```text
.
├── app/
│   ├── [handle]/page.tsx                 # Public profile route: /@handle
│   ├── api/
│   │   ├── handles/[handle]/route.ts     # Read-only handle availability check (homepage claim field)
│   │   ├── profiles/route.ts             # Stripe profile creation
│   │   ├── profiles/[handle]/route.ts    # Profile edit API
│   │   ├── profiles/[handle]/access/route.ts   # Credential-gated editor unlock
│   │   ├── profiles/[handle]/payload/route.ts  # Credential-gated raw payload view
│   │   ├── profiles/[handle]/resync/route.ts   # Credential-gated latest-data resync
│   │   └── provider-profiles/route.ts    # Non-Stripe provider creation
│   ├── create/page.tsx                   # Profile creation page
│   ├── demo/page.tsx                     # Synthetic, no-index demo page
│   ├── edit/[handle]/page.tsx            # Credential-protected edit page
│   ├── globals.css                       # Tailwind imports and theme tokens
│   ├── layout.tsx                        # Root metadata, viewport, analytics
│   └── page.tsx                          # Marketing homepage entry
├── components/
│   ├── marketing/
│   │   ├── create-profile-form.tsx
│   │   ├── demo-profile.tsx
│   │   ├── edit-profile-form.tsx
│   │   ├── edit-profile-gate.tsx
│   │   ├── claim-backdrop.tsx            # Blurred, drifting FICTIONAL preview cards + visible disclosure caption
│   │   ├── claim-handle-form.tsx         # Homepage claim field (availability check, hands off to /create)
│   │   ├── featured-profile-card.tsx     # The one real, sharp profile on the homepage
│   │   ├── home-page.tsx
│   │   ├── profile-fields.tsx
│   │   ├── provider-credential-fields.tsx
│   │   ├── public-profile.tsx
│   │   ├── revenue-chart.tsx
│   │   ├── trajectory-chart.tsx
│   │   ├── scope-manifest.tsx
│   │   ├── site-footer.tsx
│   │   └── site-header.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── chart.tsx
│       ├── checkbox.tsx
│       ├── field.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── separator.tsx
│       └── textarea.tsx
├── lib/
│   ├── db/index.ts                        # Shared pg Pool and Drizzle client
│   ├── db/schema.ts                       # Application table definitions
│   ├── providers/
│   │   ├── adapters/                      # One adapter per supported provider
│   │   ├── common.ts                      # HTTP, parsing, pagination, error helpers
│   │   ├── raw-capture.ts                 # Request-scoped capture of provider response bodies
│   │   ├── credentials.ts                 # Provider credential validation/serialization
│   │   ├── metrics.ts                     # Normalized snapshots and catalog types
│   │   ├── registry.ts                    # Providers, setup fields, metric capabilities
│   │   └── sync.ts                        # Provider ID → adapter dispatch
│   ├── security/rate-limit.ts             # Upstash limits and hashed IP identifiers
│   ├── stripe/
│   │   ├── client.ts
│   │   ├── crypto.ts
│   │   ├── probes.ts
│   │   └── sync.ts
│   ├── featured-profile.ts                # Guarded loader for the homepage's real profile (@ali)
│   ├── handle.ts                          # Client-safe handle pattern/sanitizer shared by UI and server
│   ├── reserved-handles.ts                # System/brand handles that cannot be claimed
│   ├── charge-trajectories.ts             # UTC bucketing for Revenue/MRR/Churn series
│   ├── credential-proof.ts                # Client-safe verified credential proof type
│   ├── currency.ts                        # Minor/major unit conversion and formatting
│   ├── profile-credential-proof.ts        # Shared credential proof for edits, access, and payload
│   ├── profile-links.ts                   # Profile/social link types and defaults
│   ├── profile-validation.ts              # Server-side profile input validation
│   ├── profiles.ts                        # Handle normalization and public-profile query
│   ├── stripe-permissions.ts              # Requested Stripe permission manifest
│   └── utils.ts                            # Shared UI utility
├── db/migrations/001_profile_charge_events.sql  # Manual DDL for dated charge facts
├── db/migrations/002_catalog_visibility_and_audience.sql  # is_public flags + profile_audience table
├── scripts/backfill-charge-history.ts     # One-off dated charge backfill
├── .gitignore
├── AGENTS.md                              # Repository-specific Next.js guidance
├── LICENSE.nextjs-saas-starter
├── README.md
├── architect.md                           # This document
├── components.json                        # shadcn configuration
├── next.config.mjs                        # Image config and response security headers
├── package.json                           # Scripts and dependencies
├── pnpm-lock.yaml
├── pnpm-workspace.yaml                    # pnpm workspace/package policy
├── postcss.config.mjs                     # Tailwind PostCSS plugin
└── tsconfig.json                          # Strict TypeScript and @/* alias
```

Generated or ignored artifacts such as `next-env.d.ts` and `tsconfig.tsbuildinfo` are intentionally omitted.

Provider adapters currently present in `lib/providers/adapters/` are `app-store-connect.ts`, `creem.ts`, `dodo-payments.ts`, `lemon-squeezy.ts`, `paddle.ts`, `polar.ts`, `razorpay.ts`, `revenuecat.ts`, `superwall.ts`, and `whop.ts`.

## 4. Routes and request flow

### Pages

| Route | Implementation | Behavior |
| --- | --- | --- |
| `/` | `app/page.tsx` → `HomePage` | Claim-your-handle hero over an illustrative (fictional, blurred, captioned) backdrop, one real featured profile (`@ali`, read from the DB at most once per `revalidate = 60`; omitted if the DB is unavailable), then how-it-works and trust sections |
| `/create` | `app/create/page.tsx` | Profile fields, source selection, permission/credential form. Reads `?handle=` only to prefill the handle field (dynamic rendering) |
| `/demo` | `app/demo/page.tsx` → `DemoProfile` | Fictional sample; metadata sets `noindex` |
| `/@handle` | `app/[handle]/page.tsx` | Loads and renders a published provider-backed profile; missing/invalid profiles return 404 |
| `/edit/handle` | `app/edit/[handle]/page.tsx` | Shows a verification modal first; the editor and its private fields appear only after the original provider secret is proven, and the latest raw provider payload can then be revealed |

The `@` is part of the public URL. `normalizeHandle()` removes it, URL-decodes safely, lowercases the value, and enforces the handle format.

### API routes

| Method and route | Responsibility |
| --- | --- |
| `GET /badge/:handle` | Public, read-only SVG badge. Query: `metric` (`mrr`, `revenue30`, `total`, `verified`), `theme` (`light`, `dark`, `green`), `variant` (`badge`, `merch`), `download=1`. Built by `lib/badge-svg.ts` from `lib/badge-data.ts`, which reads only aggregates already on the public profile (snapshot MRR/30-day revenue and the summed stored charges). A metric the provider doesn't report falls back to the plain verified badge. CDN-cached (`s-maxage=900`), `nosniff`, restrictive CSP, CORS `*`; no rate limiter because it is cacheable and read-only |
| `GET /api/handles/:handle` | Read-only availability check for the homepage: `available`, `taken` (with `published`), `reserved`, or `invalid`. Reserves and writes nothing; a handle is only taken once a profile is created. Own IP rate limit (60/min); returns `503 {status: "unavailable"}` if rate limiting or the DB is unavailable, which the UI treats as "can still continue". The reserved list is currently applied only here, not yet in create/edit validation |
| `POST /api/profiles` | Stripe verification, initial read-only sync, and profile creation |
| `POST /api/provider-profiles` | Generic provider credential validation, initial sync, and profile creation |
| `PUT /api/profiles/:handle` | Verify the original credential and update public profile fields/handle |
| `POST /api/profiles/:handle/access` | Verify the original credential and return the editable profile fields, including the private contact email, to unlock the editor |
| `POST /api/profiles/:handle/payload` | Verify the original credential, then decrypt and return the latest stored provider payload for the edit form |
| `POST /api/profiles/:handle/showcase` | Verify the original credential (own 20/hour limiter), then `load` or `save` the owner's showcase settings: which products/plans are public (`is_public`) and per-platform follower counts. GitHub counts are fetched from GitHub's public API and stored as `verified`; other platforms are `self_reported` and only accepted for platforms linked on the profile |
| `POST /api/profiles/:handle/resync` | Verify the original credential, decrypt the stored provider credential server-side, re-read the provider, and upsert the latest payload, snapshots, catalog, and dated charges |

The create and edit APIs accept JSON, reject non-JSON or oversized requests (24 KiB maximum), validate and normalize input on the server, return `Cache-Control: no-store`, and revalidate affected profile paths after successful writes.

## 5. Data model

Application tables are defined in `lib/db/schema.ts` with Drizzle `pgTable()` declarations, which target PostgreSQL’s `public` schema by default.

| Table | Purpose |
| --- | --- |
| `public.profiles` | Handle, display name, bio, optional private contact email, public website/app links, social-link JSON, status, and timestamps. Handles are unique, at most 32 characters, and constrained to lowercase letters, digits, and hyphens. Status is `draft`, `published`, or `suspended`. |
| `public.stripe_connections` | One Stripe connection per profile: encrypted restricted key, IV, encryption version, key mode/status, capability probe results, and review/validation timestamps. |
| `public.stripe_verification_runs` | Verification history/status, endpoint capability results, dashboard-review confirmation, error code, and run timestamps. |
| `public.revenue_snapshots` | Per-profile, per-currency period aggregates: gross charges, refunds, successful charge count, active subscriptions, MRR, period dates, and recording time. Amounts use integer minor currency units (`bigint`). |
| `public.stripe_products` | Normalized Stripe product IDs, names, active state, and sync timestamps. |
| `public.stripe_plans` | Normalized Stripe recurring price/plan IDs, product ID, amount/currency, interval, active state, and sync timestamps. |
| `public.payment_provider_connections` | One non-Stripe provider connection per profile: provider ID, encrypted credential payload, IV/version, status, and validation/sync timestamps. |
| `public.provider_payload_snapshots` | The latest full provider response payload per profile, gzip-compressed and AES-256-GCM encrypted with its provider ID, IV/version, and fetch timestamp. It may contain customer data and is never loaded into public profile data. |
| `public.profile_audience` | One row per profile and social platform: follower count and its source (`verified` from a public API, or `self_reported`). Totals on the public page are the sum of these rows. |
| `public.profile_charge_events` | One minimal row per successful captured Stripe charge: charge ID, occurred-at timestamp, currency, captured amount in minor units, a recurring-charge flag, and a one-way customer hash. Used to bucket Revenue/MRR/Churn series; no customer identity is stored. |
| `public.payment_provider_catalog_items` | Normalized non-Stripe product/plan records, external IDs, labels, optional price/currency/interval, active state, and sync timestamps. |

The app groups related records by `profile_id`. The schema declares unique indexes for handles, one connection per profile in each connection table, snapshot identity (profile + period + currency), charge identity (profile + charge), and provider catalog identity. No application table includes a user/account owner ID; the profile handle is the public identity, and the provider credential is the edit proof.

Revenue is normalized by currency. Snapshot amounts are stored as integers in minor units; `lib/currency.ts` formats them for display. Provider-specific capability flags determine whether a metric is displayed or shown as unavailable.

## 6. Database connection, provisioning, and current live state

### Runtime connection

1. The Neon integration supplies `DATABASE_URL` to the project.
2. `lib/db/index.ts` is server-only and creates a `pg.Pool` with a maximum of 5 connections, a 10-second idle timeout, and a 5-second connection timeout.
3. The pool is stored on `globalThis` to avoid duplicate pools during development reloads and passed to `attachDatabasePool()` for Vercel lifecycle handling.
4. Drizzle is initialized with the exported schema from `lib/db/schema.ts`; app queries and transactions use this shared `db` instance.

### Schema management facts

The repository contains a Drizzle schema file but no migration directory, Drizzle Kit dependency/configuration, or database migration script in `package.json`. Next.js does not create these tables automatically. The source tree therefore describes the app’s current data model but does not contain the original DDL history or prove the order in which the live database was provisioned. Schema changes must be applied to Neon through the project’s database workflow and reflected in `lib/db/schema.ts`; do not assume a local `db:push` command exists.

### Live schema inventory observed

The connected Neon schema inventory returned 23 tables:

- `public`: the ten application tables described above; current code maps and queries these.
- `epicli`: `profiles`, `metric_snapshots`, `stripe_connections`, `profile_products`, and `profile_plans`. No references to this schema were found in the current source tree. Treat it as unreferenced/legacy until separately audited; do not drop it based only on this document.
- `neon_auth`: `account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, and `verification`. These are present in the live database, but the current app does not import Better Auth or query them.

The connected schema report shows row-level security disabled on the listed tables. Database access in this app is server-side; do not expose `db`, `DATABASE_URL`, or provider credentials to client code. There is no app-level login/ownership layer in the current product.

## 7. Profile creation and provider verification

### Stripe path

1. The client form (`CreateProfileForm`) posts profile fields, a live restricted key, the four reviewed permission names, and the owner’s confirmation that all other permissions are disabled to `POST /api/profiles`.
2. The route rate-limits the request, validates body size/content type and profile fields, requires a key beginning with `rk_live_`, and fails closed if rate limiting or encryption is unavailable.
3. `probeStripePermissions()` makes read-only probes for charges, refunds, subscriptions, plans, prices, and products. `404 resource_missing` is treated as proof that the endpoint was reachable; `401`, `403`, and unavailable responses are classified separately.
4. Stripe does not expose the full restricted-key grant list through the API. Endpoint probes therefore verify access, not the absence of extra permissions; the owner must review the Stripe Dashboard and attest to the allowed read-only set.
5. `syncInitialStripeData()` reads the newest 5,000 charges for dated history, the last 30 days of charges and refunds for the aggregate snapshot, active subscriptions, active products, and recurring prices. The 30-day billing records are bounded at 500 per collection; product/price pages are bounded to 100 items. Captured successful charges become minimal `profile_charge_events` rows; recurring status is inferred from the charge description because the current Stripe charge resource does not expose an invoice ID. Customer IDs are HMAC-hashed before storage. Metrics are grouped by currency.
6. The key and full initial-sync response payload are encrypted; the route opens a database transaction and inserts the published profile, encrypted connection, verification record, payload snapshot with its fetch timestamp, aggregates, products, plans, and charge events in 500-row batches. A unique-handle conflict aborts rather than overwriting another profile.

### Other provider path

1. The form gets provider names, setup instructions, credential fields, and metric availability from `lib/providers/registry.ts`.
2. `POST /api/provider-profiles` validates the selected provider and its credential shape using `lib/providers/credentials.ts`.
3. `syncRevenueProvider()` dispatches to the matching adapter inside a request-scoped response capture. `lib/providers/common.ts` standardizes API errors, disables fetch caching, applies an 8-second request timeout, restricts pagination to the original provider origin, and enforces record/page bounds.
4. Adapters normalize provider records into currency-specific snapshots and catalog items via `lib/providers/metrics.ts`. Successful JSON, text, and binary response bodies are captured without request credentials or URLs.
5. The credentials are serialized canonically and encrypted; captured response bodies are gzip-compressed and AES-256-GCM encrypted. Both are committed with the profile, provider connection, fetch timestamp, snapshots, and catalog items in one transaction. Only the latest payload is retained, and it is never included in public profile data; it is returned only to the credential-verified edit flow. The profile is published only after the initial sync succeeds.

Supported non-Stripe sources are Lemon Squeezy, Polar, Dodo Payments, Paddle, RevenueCat, Superwall, App Store Connect, Creem, Whop, and Razorpay. Metric availability differs by source; the registry advertises which values can be shown.

## 8. Public profile and edit flow

### Public profile

`getPublicProfile()` validates the handle and selects only a `published` profile. It then determines the connected source (Stripe or generic provider); without a recognized source connection it returns no public profile. The query loads the latest aggregate snapshot, total active product/plan counts, up to eight active products and plans, and only the payload snapshot's fetch timestamp. It never selects the encrypted payload or the private contact email. The page renders MRR with an annualized run rate, the charge-volume total with its count and reporting window, active products and subscriptions, the last-fetched date, and validated public links. Credentials, contact email, and raw provider records are not part of `PublicProfileData`.

`getProfileCharts()` (one query) feeds both the trajectory chart and `lib/profile-insights.ts`, which derives monthly cumulative revenue, recurring vs one-time split, month-over-month growth, and KPIs (best month, average charge, paying and repeat customers, recurring share) from the same events. It reads the profile's dated `profile_charge_events` rows (up to the 5,000-charge cap) and `lib/charge-trajectories.ts` buckets them in UTC for the public chart. Revenue sums captured charge amounts; MRR sums captured charges flagged recurring; customer churn compares distinct hashed customers in adjacent buckets and reports prior customers without a current charge as a percentage. The chart offers Revenue/MRR/Churn and Last 24 hours/7 days/30 days/3 months/6 months/12 months/All time. Only aggregated labels and numeric values reach the browser; raw charge rows and customer hashes stay server-side. "All time" spans up to 120 monthly buckets, and the newest 5,000 charges are the storage cap.

The public page declares `revalidate = 60`. This is page-cache revalidation, not a provider sync schedule.

### Profile editing

The edit page loads only the public identity and source provider, then renders `EditProfileGate`, a non-dismissible verification modal. The modal posts to `POST /api/profiles/:handle/access`, which applies its own IP-based rate limit, compares the submitted proof with the decrypted stored credential, and only then returns the editable profile fields, including the private contact email. The gate keeps the verified proof in client memory for the tab session and mounts `EditProfileForm` after success; reloading the page locks the editor again. The gate traps keyboard focus, restores body scrolling on unlock, and links back to the public profile instead of closing into an unusable state.

`PUT /api/profiles/:handle` validates new profile fields and handle, rate-limits attempts, then re-verifies the same proof before updating. Stripe profiles require the same restricted key; other providers require the original secret credential fields. Comparison uses a timing-safe digest. If the proof matches, the route updates the profile fields/handle and revalidates old/new routes. It does not replace the stored provider credential or perform a new provider sync. Contact email is stored but never selected by the public profile query.

`POST /api/profiles/:handle/payload` accepts the same credential proof and uses its own IP-based rate limit so payload views do not consume the save budget. `lib/profile-credential-proof.ts` performs the Stripe/generic-provider verification for the access, edit, payload, and resync routes. After a match, the payload route reads the profile's latest `provider_payload_snapshots` row, decrypts it server-side, and returns the provider ID, fetch timestamp, and raw payload. The edit form renders that payload as indented JSON in a scrollable raw-data panel. No payload is returned before verification, and the response is `Cache-Control: no-store`.

`POST /api/profiles/:handle/resync` lets the verified owner refresh the latest provider data without changing profile details. It applies its own IP-based rate limit, verifies the submitted proof, then decrypts the stored provider credential server-side and re-runs the Stripe or generic sync. The route upserts the encrypted payload snapshot, revenue snapshots, products/plans (deactivating items the provider no longer returns), and inserts any new dated charge events idempotently. It returns only the provider ID, resync timestamp, and record counts; credentials and raw provider data are never returned. The edit form exposes this as a "Resync latest data" action after the editor is unlocked.

There are no user accounts, email/password login, or per-user profile ownership checks in the current application.

## 9. Security and data handling

- **Credential encryption:** `lib/stripe/crypto.ts` uses AES-256-GCM with a random 12-byte IV and versioned payloads. A 32-byte master key comes from `EPICLI_KEY_ENCRYPTION_KEY` (64-character hex or base64 encoding); HKDF-SHA-256 derives purpose-specific keys. Associated data binds ciphertext to its purpose/provider. The same module encrypts Stripe keys and generic provider credentials.
- **Credential proof:** Editor access, profile updates, and payload views compare submitted credentials to decrypted stored credentials server-side; secrets are not returned in API responses. Generic-provider proof includes secret fields only.
- **Contact email privacy:** `profiles.contact_email` is stored for the owner's private records only. It is excluded from `getPublicProfile()` and from every public page, and is returned only by the credential-gated access route.
- **Input validation:** handle, text, email, URL, and social links are normalized/validated server-side. Profile URLs only allow HTTP(S) without embedded username/password; social URLs require HTTPS and an allowlisted host.
- **Rate limits:** creation, editing, editor access, payload viewing, and data resync each use a separate Upstash sliding window of 5 attempts per hour; the read-only handle check uses its own 60-per-minute window. The client IP is HMAC-hashed before it becomes the Redis identifier. Missing Upstash configuration makes the mutation unavailable rather than silently unthrottled.
- **Provider payload privacy:** the latest successful provider response bodies may contain customer data, so they are gzip-compressed and AES-256-GCM encrypted with a provider-specific key. They are stored server-side in one row per profile, never selected by public queries, and replaced rather than retained as a history on a future sync. Public pages receive only the fetch timestamp. The edit form can request the decrypted payload only after the same credential proof required to save changes; unauthenticated visitors cannot retrieve it.
- **Data minimization:** persisted revenue is aggregated by period/currency, while public catalog data is limited to product/plan labels and relevant pricing metadata. The dated charge table stores only charge ID, timestamp, currency, captured amount, recurring flag, and a keyed one-way customer hash; no customer name, email, card, or payment-method data is stored outside the encrypted provider payload.
- **Stripe permission boundary:** the app accepts live restricted keys, not `sk_live_` full-access keys. Only read operations are used. The full permission list still requires owner review because Stripe’s API cannot reveal it.
- **Response headers:** `next.config.mjs` sets `nosniff`, strict-origin referrer policy, HSTS, `SAMEORIGIN` framing, and disables camera/microphone/geolocation. CSP is currently `Content-Security-Policy-Report-Only`, so it reports but does not enforce violations.
- **Caching:** provider fetches and mutation APIs use `no-store`; API responses are not cacheable. The profile page’s 60-second revalidation only affects rendered database-backed content.

## 10. Environment configuration

These are the application-specific variables directly referenced by current code (in addition to standard `NODE_ENV`, which gates production analytics):

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection for the shared `pg` pool |
| `EPICLI_KEY_ENCRYPTION_KEY` | Master key used to derive credential and provider-payload encryption keys |
| `KV_REST_API_URL` | Upstash Redis REST endpoint for rate limiting |
| `KV_REST_API_TOKEN` | Upstash authentication and HMAC keying for rate-limit identifiers |

The app does not reference a platform `STRIPE_SECRET_KEY`; profile owners submit their own provider credential. Environment files are ignored by `.gitignore` (`.env*`). Never commit actual secret values.

## 11. Deployment and development

The README identifies this as a v0-linked Next.js project; it states that merges to `main` deploy automatically. `app/layout.tsx` enables Vercel Analytics only in production.

Available package scripts are:

```text
pnpm dev      # Next.js development server
pnpm build    # production build
pnpm start    # serve the production build
```

There are no test, lint, or database-migration scripts in `package.json`, and no test files were found. `db/migrations/002_catalog_visibility_and_audience.sql` is additive (defaults keep every item public) and must be applied before this code is deployed. The dated-charge table has a manual DDL file at `db/migrations/001_profile_charge_events.sql`; it must be applied to Neon before the trajectory queries run. Profiles created before this table can be backfilled idempotently with `pnpm dlx tsx scripts/backfill-charge-history.ts` using `DATABASE_URL` and `EPICLI_KEY_ENCRYPTION_KEY`; the script decrypts each stored Stripe key in memory and fetches up to 5,000 newest charges. The provider sync runs synchronously during profile creation and owner-triggered resync (the Stripe, generic-provider, and resync routes allow up to 60 seconds). No scheduled refresh, webhook, cron, or background sync route is present. Consequently, the initial snapshot and charge history are not automatically refreshed by the 60-second page revalidation.

## 12. Source-of-truth notes

- Runtime queries are implemented in `lib/profiles.ts` and the three API route handlers; `lib/db/schema.ts` is the app’s Drizzle model.
- The live Neon database contains more schemas than this repository uses. Verify ownership and consumers before changing or removing any unreferenced tables.
- The repository does not record the original database migration sequence. This document intentionally distinguishes the schema visible in code from the live schema inventory.
- No app-level authentication is implemented, even though Neon’s live database includes `neon_auth` tables.

## Badges and merch

`/@handle/badges` (`components/marketing/badge-studio.tsx`) previews the live badge, offers SVG and client-side PNG export (SVG drawn to a canvas, so no server rasterizer), and copyable Markdown, HTML and URL snippets. The merch section shows a t-shirt mockup of the square artwork (`variant=merch`), a 3200px PNG, the vector SVG, and `/@handle/badges/print`, a bare page that prints the artwork at 7x7 in. epic.li does not sell or ship merch. Merch artwork prints the as-of date so a printed number is never presented as live. SVG text uses a generic monospace font with estimated widths; outline the text in a design tool for pixel-exact print.

The merch artwork includes a QR code to the profile URL (`lib/qr.ts` builds the module matrix with the `qrcode` package; `lib/badge-svg.ts` draws it as one SVG path inside a white quiet-zone box so it scans on every theme; the URL's origin comes from the request, so forks print their own domain). The t-shirt preview (`components/marketing/tee-mockup.tsx`) is a layered vector mockup: soft shadow, side/top shading, underarm and fold shadows, rib collar with a visible back neck, stitched seams, and a fabric-grain overlay above the print. The print is multiplied onto light shirts and drawn normally on dark ones. The profile header shows a verification card (provider, fetch date, MRR, total revenue, reach, paying customers, and the live badge) beside the name.

## Launch readiness

- **Homepage featuring is opt-in.** `profiles.feature_on_homepage` (default false) + `showcase_reviewed_at`. `getLatestPublishedHandles` only returns profiles with both set. The create form has an optional consent checkbox; after publishing, the owner reviews products/plans in `ShowcaseEditor` (auto-loaded, proof held in memory only). Saving the showcase sets `showcase_reviewed_at` and the feature flag. Migration: `db/migrations/003_homepage_feature_consent.sql` (additive; apply before deploying).
- **Showcase editor** has Select all / Unselect all per group (Products, Plans).
- **Legal pages:** `/terms`, `/privacy`, `/cookies` (drafts matching real data handling; not lawyer-reviewed). Footer links; create form requires agreeing.
- **Favicon:** `app/icon.svg` and `app/apple-icon.png` use the Next.js file convention; the old `icons` metadata pointing at missing PNGs was removed.
- **Provider audit fixes:** Creem `next_page` is a number (was treated as a URL); App Store sales reports pin `filter[version]=1_3`; Dodo payments are filtered by `created_at_gte`. Not verifiable from docs: Superwall column names `currencyCode`/`productId`.

## Canonical domain and email

`lib/site.ts` exports `SITE_URL` (`NEXT_PUBLIC_SITE_URL`, default `https://epic.li`). Embed snippets, the merch QR code and `metadataBase` use it instead of the request origin. `lib/email.ts` sends transactional mail through Amazon SES (`SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `EMAIL_FROM`); `.env.example` lists them. Nothing calls it yet.

**Chest print:** merch has a frameless `layout=chest` artwork (pill, @handle, optional amount, EPIC.LI, optional QR; `tone=dark|light` follows the shirt) and `qr=0` removes the QR from either layout. The studio defaults to chest with QR on.
