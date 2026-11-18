import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = { title: "Cookie Policy — epic.li" }

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy">
      <section>
        <h2>Short version</h2>
        <p>epic.li does not set advertising or tracking cookies and has no login session cookies, because there are no accounts.</p>
      </section>
      <section>
        <h2>Analytics</h2>
        <p>
          In production we use Vercel Web Analytics, which measures page views without cookies and without following you across sites.
          It records page path, referrer, country and basic device information in aggregate.
        </p>
      </section>
      <section>
        <h2>Storage on your device</h2>
        <p>The app does not rely on cookies or local storage for its features. Credentials you type are held in page memory only and cleared after submission.</p>
      </section>
      <section>
        <h2>Third-party content</h2>
        <p>Pages may load images (for example the author portrait from Vercel Blob). Those hosts receive your IP address as for any web request.</p>
      </section>
    </LegalPage>
  )
}
