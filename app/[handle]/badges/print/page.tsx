import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrintButton } from "@/components/marketing/print-button"
import { isBadgeMetric, isBadgeTheme } from "@/lib/badge-svg"
import { normalizeHandle } from "@/lib/profiles"

type PrintPageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ metric?: string; theme?: string; layout?: string; qr?: string; tone?: string }>
}

export const metadata: Metadata = { title: "Print sheet | epic.li", robots: { index: false } }

/** Bare page: just the artwork at a fixed physical size so "Print" gives a clean sheet. */
export default async function PrintPage({ params, searchParams }: PrintPageProps) {
  const handle = normalizeHandle((await params).handle)
  if (!handle) notFound()
  const { metric, theme, layout, qr, tone } = await searchParams
  const safeMetric = isBadgeMetric(metric) ? metric : "mrr"
  const safeTheme = isBadgeTheme(theme) ? theme : "light"
  const src = `/badge/${encodeURIComponent(handle)}?variant=merch&metric=${safeMetric}&theme=${safeTheme}${layout === "chest" ? `&layout=chest&tone=${tone === "dark" ? "dark" : "light"}` : ""}${qr === "0" ? "&qr=0" : ""}`

  return (
    <main className="mx-auto grid min-h-screen max-w-3xl place-items-center gap-6 bg-white p-6 text-[#1c1c16] print:p-0">
      <div className="print:hidden text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#087d32]">// Print sheet</p>
        <p className="mt-2 text-sm text-[#53614e]">
          Prints at 7 × 7 in. In the print dialog, turn off headers and footers and enable background graphics.
        </p>
        <div className="mt-3">
          <PrintButton />
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG endpoint */}
      <img src={src} alt={`Merch artwork for @${handle}`} className="h-auto w-[7in] max-w-full print:max-w-none" />
    </main>
  )
}
