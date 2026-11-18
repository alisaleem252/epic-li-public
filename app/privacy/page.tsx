import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = { title: "Privacy Policy — epic.li" }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Profile details you enter: handle, display name, bio, links, and an optional private contact email (never shown publicly).</li>
          <li>Your read-only provider credential, stored encrypted (AES-256-GCM) so the page can refresh and so you can prove ownership when editing.</li>
          <li>Aggregate revenue metrics, product and plan names, and (for charts) per-day totals derived from provider data. Customer identifiers, where used, are hashed and customer records and raw provider responses are not stored.</li>
          <li>Optional follower counts you enter, and a GitHub follower count fetched from GitHub&apos;s public API if you link GitHub.</li>
          <li>Rate limiting: a keyed hash of your IP address, held temporarily in Upstash Redis. The raw IP is not stored.</li>
          <li>Page-view analytics from Vercel Web Analytics in production (see Cookie Policy).</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>To render your public page, badges and embeds, keep figures fresh, prevent abuse, and operate the service. We do not sell data or use it for advertising.</p>
      </section>
      <section>
        <h2>Who processes it</h2>
        <ul>
          <li>Vercel (hosting, analytics), Neon (Postgres database), Upstash (rate limiting) and your payment provider (whose API we call with your key).</li>
        </ul>
      </section>
      <section>
        <h2>Public by design</h2>
        <p>Anything shown on your page, badge or embed is visible to anyone and may be cached or copied by third parties.</p>
      </section>
      <section>
        <h2>Retention and your rights</h2>
        <p>
          Data is kept while your page exists. You may request access, correction or deletion (including the stored credential) via the
          contact in the project repository. Revoking the key at your provider stops all further reads immediately. Depending on where
          you live you may have additional rights under laws such as the GDPR or CCPA; contact us to exercise them.
        </p>
      </section>
      <section>
        <h2>Security</h2>
        <p>Credentials are encrypted at rest and used server-side only. No system is perfectly secure; use read-only keys and rotate them if in doubt.</p>
      </section>
    </LegalPage>
  )
}
