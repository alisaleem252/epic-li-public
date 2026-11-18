<div align="center">

# epic.li

**Proof, not screenshots.**
A verified public revenue profile for indie founders, built from a read-only provider key.

[**epic.li**](https://epic.li) · [Live demo](https://epic.li/demo) · [Create a profile](https://epic.li/create) · [Architecture](architect.md)

</div>

---

Anyone can screenshot a dashboard and claim $10,000 MRR. epic.li makes the number checkable instead: you paste a **read-only key** from your payment provider, epic.li fetches your real revenue server-side, and publishes a profile at `epic.li/@handle` with only the aggregates you chose to show.

- **No account, no password.** To edit a profile later you prove you own it by re-submitting the same provider key.
- **Totals only.** Public pages show aggregate revenue, MRR, subscriber counts and the product or plan names you pick. Never customer names, emails or card data.
- **Embeddable proof.** SVG badges for your README, site or email signature, plus print-ready merch artwork with a QR code back to your profile.
- **Open source.** Read the code that touches your key, or run your own instance.

## How it works

1. **Connect.** Pick a provider and paste a read-only key. For Stripe, one click opens a restricted key pre-filled with the four read permissions needed.
2. **Verify.** The server calls the provider's API, builds the snapshot and stores your key and the raw response encrypted.
3. **Share.** Choose which products to show, then publish `epic.li/@handle`, add a badge anywhere, and optionally opt in to the homepage showcase.

Snapshots are taken at creation and whenever the owner triggers a resync. There is no background refresh, so every profile shows the time it was last fetched.

## Supported providers

| Provider | Revenue | Charges | Active subs | MRR |
| --- | :-: | :-: | :-: | :-: |
| Stripe (restricted key) | ✅ | ✅ | ✅ | ✅ |
| Lemon Squeezy | ✅ | ✅ | ✅ | ✅ |
| Paddle Billing | ✅ | ✅ | ✅ | ✅ |
| Polar | ✅ | ✅ | ✅ | ✅ |
| Dodo Payments | ✅ | ✅ | ✅ | ✅ |
| Creem | ✅ | ✅ | ✅ | ✅ |
| Whop | ✅ | ✅ | ✅ | ✅ |
| Razorpay | ✅ | ✅ | ✅ | ✅ |
| RevenueCat | ✅ | – | ✅ | ✅ |
| Superwall | ✅ | ✅ | – | – |
| App Store Connect | ✅ | ✅ | – | – |

Every adapter only performs read requests. Some providers (for example Lemon Squeezy) don't offer scoped keys, so the setup screen tells you what the key can reach and how to revoke it.

## Embed your badge

```md
[![epic.li verified](https://epic.li/badge/YOURHANDLE)](https://epic.li/@YOURHANDLE)
```

The badge studio at `epic.li/@handle/badges` generates snippets for you. Under the hood it is one SVG endpoint:

| Param | Values | Default |
| --- | --- | --- |
| `metric` | `mrr`, `revenue30`, `total`, `verified` | `mrr` (falls back to `verified` if the profile has no figure) |
| `theme` | `light`, `dark`, `green` | `light` |
| `shape` | `wide`, `stacked` | `wide` |
| `variant` | `badge`, `merch` | `badge` |
| `layout` | `chest` (frameless print artwork, with `variant=merch`) | full card |
| `tone` | `dark`, `light` (chest layout, match the shirt colour) | `light` |
| `qr` | `0` removes the QR code from merch artwork | on |
| `download` | `1` serves the file as a download | off |

Example: `https://epic.li/badge/YOURHANDLE?shape=stacked&theme=dark&metric=mrr`

epic.li does not sell or ship merch. It gives you the artwork (SVG, 3200px PNG, or a print page at 7×7 in) to print wherever you like.

## Privacy and security model

- **Keys never reach the browser.** Provider credentials are used server-side for read requests only and are stored with AES-256-GCM (HKDF-derived, purpose-bound keys).
- **Raw provider responses stay private.** They can contain customer data, so they are encrypted at rest, never returned by public queries, and replaced on each sync rather than kept as history.
- **Minimal stored data.** Persisted revenue is aggregated by period and currency. The dated charge table keeps only charge ID, timestamp, currency, amount, recurring flag and a keyed one-way customer hash.
- **Your contact email is private.** It is never exposed on public pages.
- **Rate limited.** Create, edit, unlock, payload view and resync are each limited per IP (hashed) via Upstash. If Upstash isn't configured, those actions are disabled instead of left unthrottled.
- **Hardened responses.** `nosniff`, HSTS, strict referrer policy and a restrictive permissions policy. CSP is currently report-only.

Details and the full threat notes are in [architect.md](architect.md#9-security-and-data-handling). To report a vulnerability, please don't open a public issue; contact the maintainer privately via [alisaleem252.com](https://alisaleem252.com).

## Run it yourself

**Requirements:** Node.js 20.9+, [pnpm](https://pnpm.io), a PostgreSQL database (Neon recommended), and an [Upstash Redis](https://upstash.com) database for rate limiting.

```bash
git clone https://github.com/alisaleem252/epic-li-public.git
cd epic-li-public
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev                     # http://localhost:3000
```

> This project uses a recent Next.js with breaking changes from older versions. If you contribute, read the guides in `node_modules/next/dist/docs/` first (see [AGENTS.md](AGENTS.md)).

### Environment variables

| Variable | Required | Purpose |
| --- | :-: | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `EPICLI_KEY_ENCRYPTION_KEY` | ✅ | 32-byte master key (64-char hex or base64). Generate with `openssl rand -hex 32`. **Losing it makes stored credentials unreadable.** |
| `KV_REST_API_URL` | ✅ | Upstash Redis REST URL (rate limiting) |
| `KV_REST_API_TOKEN` | ✅ | Upstash Redis REST token |
| `NEXT_PUBLIC_SITE_URL` | – | Canonical origin for badges, QR codes and metadata. Defaults to `https://epic.li`; **set this on a fork** |
| `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `EMAIL_FROM` | – | Amazon SES transactional email. Optional; no feature sends mail yet |
| `GITHUB_TOKEN` | – | Raises the GitHub API rate limit when reading follower counts |

Never commit real values. `.env*` files are git-ignored.

### Database

The schema is defined in [`lib/db/schema.ts`](lib/db/schema.ts) (Drizzle). Changes are applied as plain SQL files, in order, in [`db/migrations/`](db/migrations):

| File | Adds |
| --- | --- |
| `001_profile_charge_events.sql` | dated charge history |
| `002_catalog_visibility_and_audience.sql` | per-item visibility and audience reach |
| `003_homepage_feature_consent.sql` | opt-in homepage featuring |

Run any new migration against your database **before** deploying the code that needs it. For profiles created before charge history existed, `pnpm dlx tsx scripts/backfill-charge-history.ts` fills it in (idempotent).

> **Known gap:** the migrations are incremental and the original base-table DDL is not in the repo yet, so a brand-new database must be created from `lib/db/schema.ts` first. Contributions that add a base schema file are very welcome.

### Scripts

```bash
pnpm dev     # development server
pnpm build   # production build
pnpm start   # serve the production build
```

Deploys to [Vercel](https://vercel.com) with no extra configuration; merges to `main` deploy automatically on the hosted instance.

## Project layout

```text
app/            Routes: /@handle, /create, /edit, /demo, /badge, legal pages, API
components/     marketing/ (forms, badge studio, tee mockup) and ui/ primitives
lib/providers/  registry.ts (provider definitions) + adapters/ (one file per provider)
lib/security/   Upstash rate limiting
lib/db/         Drizzle schema and pooled connection
db/migrations/  manual SQL migrations
scripts/        one-off maintenance scripts
architect.md    in-depth architecture, data model and security notes
```

## Contributing

Pull requests are welcome, especially new providers.

**Adding a provider**

1. Add its id and definition (name, setup steps, credential fields, metric capabilities) to [`lib/providers/registry.ts`](lib/providers/registry.ts).
2. Create `lib/providers/adapters/<provider>.ts` exporting a sync function that uses **read-only** endpoints and returns the same snapshot shape as the existing adapters.
3. Register it in [`lib/providers/sync.ts`](lib/providers/sync.ts).
4. Add its mark to the provider logo component and update the table above.

Please keep changes small and focused, open the PR against `main`, and describe how you verified the provider's API behaviour. Never include real keys in code, tests, issues or screenshots.

## Acknowledgements

Built with [Next.js](https://nextjs.org), React, Tailwind CSS, Drizzle ORM, Neon, Upstash and Vercel. Started from [v0](https://v0.app) and the Vercel Next.js SaaS starter (MIT).
