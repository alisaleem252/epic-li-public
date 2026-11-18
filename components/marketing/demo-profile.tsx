import Link from "next/link"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { ScopeManifest } from "@/components/marketing/scope-manifest"
import { RevenueChart } from "@/components/marketing/revenue-chart"

const sampleProducts = [
  { name: "API Studio", kind: "Annual plan", mrr: "$34,200", share: "53%" },
  { name: "Indie Toolkit", kind: "Monthly plan", mrr: "$18,080", share: "28%" },
  { name: "Workspace Pro", kind: "Team plan", mrr: "$12,000", share: "19%" },
]

const sampleCharges = [
  { id: "ch_demo_8f3a", date: "APR 18", amount: "$249.00", status: "SUCCEEDED" },
  { id: "ch_demo_2c91", date: "APR 17", amount: "$99.00", status: "SUCCEEDED" },
  { id: "ch_demo_74e1", date: "APR 16", amount: "$1,200.00", status: "SUCCEEDED" },
  { id: "ch_demo_c620", date: "APR 15", amount: "$49.00", status: "SUCCEEDED" },
]

function StatCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) {
  return (
    <article className="flex min-h-32 flex-col justify-between border-2 border-[#1c1c16] bg-white p-4 shadow-[3px_3px_0px_#1c1c16]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#53614e]">{label}</p>
      <div>
        <p className={`mt-3 font-mono text-2xl font-bold tracking-[-0.06em] sm:text-3xl ${accent ? "text-[#087d32]" : "text-[#1c1c16]"}`}>
          {value}
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.07em] text-[#687566]">{detail}</p>
      </div>
    </article>
  )
}

export function DemoProfile() {
  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <div className="border-b-2 border-[#1c1c16] bg-[#ffddaf] px-4 py-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] sm:text-[10px]">
          <span>Demo profile // synthetic sample data</span>
          <span>Not connected to Stripe · No live metrics</span>
        </div>
      </div>
      <SiteHeader />

      <main>
        <section className="border-b-2 border-[#1c1c16] bg-[#f7f3ea] px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="grid size-20 shrink-0 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] text-2xl font-bold tracking-[-0.08em] shadow-[5px_5px_0px_#1c1c16] sm:size-24 sm:text-3xl" aria-label="Sarah Chen initials">
                SC
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="border border-[#1c1c16] bg-[#1c1c16] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#fdf9f0]">
                    Sample only
                  </span>
                  <span className="border border-[#1c1c16] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]">
                    Stripe not linked
                  </span>
                </div>
                <h1 className="text-3xl font-bold uppercase leading-none tracking-[-0.07em] sm:text-5xl">Sarah Chen</h1>
                <p className="mt-2 font-mono text-xs font-bold text-[#53614e] sm:text-sm">@sarahbuilds · Independent product builder</p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475044]">
                  A fictional profile showing how an epic.li revenue page can present a Stripe-backed snapshot without exposing customer records.
                </p>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Sample profile links">
                  <a href="https://example.com/sarah" target="_blank" rel="noreferrer" className="border border-[#1c1c16]/30 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">Website</a>
                  <a href="https://app.example.com" target="_blank" rel="noreferrer" className="border border-[#1c1c16]/30 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">Open app</a>
                  <a href="https://x.com/sarahbuilds" target="_blank" rel="noreferrer" className="border border-[#1c1c16]/30 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">X</a>
                  <a href="https://github.com/sarahbuilds" target="_blank" rel="noreferrer" className="border border-[#1c1c16]/30 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">GitHub</a>
                </div>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#687566]">Sample public links only · contact email is private</p>
              </div>
            </div>
            <Link
              href="/create"
              className="inline-flex w-fit items-center gap-2 border-2 border-[#1c1c16] bg-[#00e55b] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16]"
            >
              Create your profile <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section aria-label="Sample revenue metrics" className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active subscription MRR" value="$64,280" detail="Illustrative sample" accent />
            <StatCard label="30-day successful charges" value="$84,390" detail="Illustrative sample" />
            <StatCard label="Active products" value="03" detail="Illustrative sample" />
            <StatCard label="Last data sync" value="DEMO" detail="No Stripe connection" />
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl border-y-2 border-[#1c1c16] lg:grid-cols-12">
          <section className="border-b-2 border-[#1c1c16] bg-[#101712] p-5 text-[#e5f4e7] sm:p-7 lg:col-span-5 lg:border-r-2 lg:border-b-0">
            <div className="flex items-center justify-between gap-3 border-b border-[#00e55b]/30 pb-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#a9d5b1] sm:text-[10px]">
              <span>Revenue terminal</span>
              <span className="text-[#00e55b]">Sample / offline</span>
            </div>
            <div className="mt-5 border border-[#00e55b]/30 bg-[#161d19] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#a9d5b1]">Example lifetime charge volume</p>
                  <p className="mt-2 font-mono text-3xl font-bold tracking-[-0.07em] text-[#00e55b] sm:text-4xl">$1,842,910</p>
                </div>
                <span className="border border-[#00e55b]/40 px-2 py-1 font-mono text-[8px] font-bold uppercase text-[#00e55b]">Demo</span>
              </div>
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#a9b7aa]">
                Sample calculation · no Stripe account or customer data is connected.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="border border-[#00e55b]/25 bg-[#161d19] p-3">
                <p className="font-mono text-[9px] uppercase text-[#a9b7aa]">Active MRR</p>
                <p className="mt-2 font-mono text-xl font-bold text-[#00e55b]">$64,280</p>
              </div>
              <div className="border border-[#00e55b]/25 bg-[#161d19] p-3">
                <p className="font-mono text-[9px] uppercase text-[#a9b7aa]">Annualized run rate</p>
                <p className="mt-2 font-mono text-xl font-bold text-[#00e55b]">$771K</p>
              </div>
            </div>

            <div className="mt-4 border border-[#00e55b]/25 bg-[#0b0f0c] p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#a9d5b1]">
                <span>Example MRR trend</span>
                <span>Synthetic</span>
              </div>
              <RevenueChart />
              <p className="font-mono text-[9px] leading-relaxed text-[#a9b7aa]">All chart values are synthetic demo data. Live profiles add Revenue/MRR/Churn and time-range selectors computed from dated charges.</p>
            </div>

            <div className="mt-4 border border-[#00e55b]/25 bg-[#111713] p-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#a9d5b1]">Data boundary</p>
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#a9b7aa]">
                Public metrics only. Charge responses may contain billing fields; the live app encrypts the raw response server-side, keeps it out of public profile data, and reveals it only to the credential-verified owner.
              </p>
            </div>
          </section>

          <section className="border-b-2 border-[#1c1c16] bg-[#fdf9f0] p-5 sm:p-7 lg:col-span-4 lg:border-r-2 lg:border-b-0">
            <div className="flex items-center justify-between border-b-2 border-[#1c1c16] pb-3">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#087d32]">// Catalog snapshot</p>
                <h2 className="mt-1 text-xl font-bold uppercase tracking-[-0.05em]">Revenue streams</h2>
              </div>
              <span className="border border-[#1c1c16] bg-[#e7f6e7] px-2 py-1 font-mono text-[9px] font-bold">03 / SAMPLE</span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {sampleProducts.map((product, index) => (
                <article key={product.name} className="border-2 border-[#1c1c16] bg-white p-3 shadow-[3px_3px_0px_#1c1c16]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#087d32]">NODE_0{index + 1}</p>
                      <h3 className="mt-1 font-bold tracking-[-0.03em]">{product.name}</h3>
                      <p className="mt-1 font-mono text-[9px] uppercase text-[#687566]">{product.kind}</p>
                    </div>
                    <span className="border border-[#1c1c16] bg-[#f2ede4] px-2 py-1 font-mono text-[9px] font-bold">DEMO</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-[#1c1c16]/15 pt-3">
                    <span className="font-mono text-[9px] uppercase text-[#53614e]">Example MRR</span>
                    <span className="font-mono text-sm font-bold text-[#087d32]">{product.mrr}</span>
                  </div>
                  <div className="mt-2 h-1.5 border border-[#1c1c16] bg-[#f2ede4]">
                    <div className="h-full bg-[#00e55b]" style={{ width: product.share }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="bg-[#f7f3ea] p-5 sm:p-7 lg:col-span-3">
            <div className="border-b-2 border-[#1c1c16] pb-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-[#087d32]">// Activity sample</p>
              <h2 className="mt-1 text-xl font-bold uppercase tracking-[-0.05em]">Recent charges</h2>
            </div>
            <p className="mt-3 font-mono text-[9px] leading-relaxed text-[#53614e]">
              Fictional transaction IDs and amounts, shown for layout only. Live profiles publish aggregate metrics and catalog labels, never transaction records, customer names, emails, or payment details.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-56 border-collapse text-left font-mono text-[9px]">
                <caption className="sr-only">Fictional sample charge activity</caption>
                <thead>
                  <tr className="border-b border-[#1c1c16]/25 text-[#53614e]">
                    <th scope="col" className="pb-2 pr-2 font-bold">DATE / ID</th>
                    <th scope="col" className="pb-2 text-right font-bold">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleCharges.map((charge) => (
                    <tr key={charge.id} className="border-b border-[#1c1c16]/10">
                      <td className="py-3 pr-2">
                        <span className="block font-bold">{charge.date}</span>
                        <span className="mt-1 block text-[#687566]">{charge.id}</span>
                        <span className="mt-1 inline-block text-[#087d32]">{charge.status}</span>
                      </td>
                      <td className="py-3 text-right font-bold">{charge.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 border-2 border-dashed border-[#1c1c16]/35 p-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]">Scope status</p>
              <p className="mt-2 font-mono text-[9px] leading-relaxed text-[#53614e]">
                No key was submitted. This page does not represent a verified Stripe connection.
              </p>
            </div>
          </section>
        </div>

        <section className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#087d32]">// Demo scope manifest</p>
              <h2 className="mt-2 max-w-lg text-3xl font-bold uppercase leading-[0.95] tracking-[-0.07em] sm:text-4xl">
                The requested reads, not a live audit.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#53614e]">
                This sample shows the permission preset from the Stripe link. Live onboarding still needs key checks and a dashboard-level review of its complete grant set.
              </p>
            </div>
            <ScopeManifest demo />
          </div>
        </section>
      </main>

      <SiteFooter
        brand="epic.li // demo profile"
        note="Sample values only · no live Stripe data"
        tone="dark"
      />
    </div>
  )
}
