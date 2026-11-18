import type { Metadata } from "next"
import { LegalPage } from "@/components/marketing/legal-page"

export const metadata: Metadata = { title: "Terms of Service — epic.li" }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2>1. What epic.li does</h2>
        <p>
          epic.li lets you publish a public page at <code>epic.li/@handle</code> showing revenue figures read from your payment
          provider with a read-only key you supply. There are no accounts; control of a page is proven by presenting the
          original provider credential.
        </p>
      </section>
      <section>
        <h2>2. Your responsibilities</h2>
        <ul>
          <li>Only connect a provider account you own or are authorised to publish figures for.</li>
          <li>Use a read-only key with the minimum permissions described in the setup steps. Revoke it at the provider at any time.</li>
          <li>Do not use handles, names, bios or links that impersonate others, infringe rights, or are unlawful or abusive.</li>
          <li>Do not attempt to bypass rate limits, probe other users&apos; pages, or misuse the badge, embed or QR features.</li>
        </ul>
      </section>
      <section>
        <h2>3. What is published</h2>
        <p>
          Aggregate metrics, product and plan names you leave visible, and the profile details you enter are public. You can hide
          products and plans in the showcase settings. Featuring on the homepage is optional and off unless you tick it and review
          your product list.
        </p>
      </section>
      <section>
        <h2>4. Accuracy</h2>
        <p>
          Figures come from the provider&apos;s API at the time of the last sync and may be delayed, incomplete or affected by
          provider outages or currency conversion. A verified badge means the data was read with a valid key; it is not an audit,
          financial statement or endorsement. Do not rely on it for investment or lending decisions.
        </p>
      </section>
      <section>
        <h2>5. Removal</h2>
        <p>
          You can ask for a page to be removed via the contact in the project repository. We may suspend or remove pages that
          break these terms or that we cannot keep accurate.
        </p>
      </section>
      <section>
        <h2>6. No warranty, limited liability</h2>
        <p>
          The service is provided &quot;as is&quot;, without warranties of any kind. To the extent permitted by law, the operator
          is not liable for indirect or consequential loss, or for loss arising from use of or inability to use the service.
        </p>
      </section>
      <section>
        <h2>7. Open source and changes</h2>
        <p>
          The source code is published under its repository licence. These terms may change; continued use after an update means
          you accept the new version.
        </p>
      </section>
    </LegalPage>
  )
}
