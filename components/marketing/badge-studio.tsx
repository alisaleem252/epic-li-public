"use client"

import { useState } from "react"
import { SITE_URL } from "@/lib/site"
import { TeeMockup } from "@/components/marketing/tee-mockup"
import { BADGE_THEMES, METRIC_LABELS, type BadgeMetric, type BadgeShape, type BadgeTheme } from "@/lib/badge-svg"

type Props = {
  handle: string
  /** Metrics this profile can actually show (always includes "verified"). */
  metrics: BadgeMetric[]
  amounts: Partial<Record<Exclude<BadgeMetric, "verified">, string>>
  asOf: string
}

const TEES = [
  { key: "cream", label: "Cream", fill: "#eadfc6", dark: false },
  { key: "ink", label: "Ink", fill: "#24241e", dark: true },
  { key: "green", label: "Green", fill: "#19c862", dark: false },
  { key: "white", label: "White", fill: "#f6f5f1", dark: false },
] as const

async function rasterize(url: string, scale: number, filename: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Badge could not be loaded")
  const objectUrl = URL.createObjectURL(new Blob([await response.text()], { type: "image/svg+xml" }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Badge could not be drawn"))
      image.src = objectUrl
    })
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas is unavailable")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("PNG export failed")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 5000)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
    } catch {
      setState("failed")
    }
    window.setTimeout(() => setState("idle"), 2000)
  }

  return (
    <div className="border-2 border-[#1c1c16] bg-white">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[#1c1c16] bg-[#f2ede4] px-3 py-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-8 border-2 border-[#1c1c16] bg-[#00e55b] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c16]"
        >
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap break-all">{value}</pre>
    </div>
  )
}

function Choice<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string
  value: T
  options: Array<{ key: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#53614e]">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={
              "min-h-10 border-2 border-[#1c1c16] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c16] " +
              (value === option.key ? "bg-[#1c1c16] text-[#00e55b] shadow-none" : "bg-white shadow-[3px_3px_0_#1c1c16] hover:bg-[#f2ede4]")
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function ActionButton({ onClick, children, busy }: { onClick: () => void; children: React.ReactNode; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="min-h-11 border-2 border-[#1c1c16] bg-white px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] hover:bg-[#f2ede4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] disabled:opacity-60"
    >
      {busy ? "Working…" : children}
    </button>
  )
}

export function BadgeStudio({ handle, metrics, amounts, asOf }: Props) {
  const origin = SITE_URL
  const [metric, setMetric] = useState<BadgeMetric>(metrics[0] ?? "verified")
  const [theme, setTheme] = useState<BadgeTheme>("light")
  const [shape, setShape] = useState<BadgeShape>("wide")
  const [merchTheme, setMerchTheme] = useState<BadgeTheme>("light")
  const [merchLayout, setMerchLayout] = useState<"chest" | "card">("chest")
  const [merchQr, setMerchQr] = useState<"on" | "off">("on")
  const [tee, setTee] = useState<(typeof TEES)[number]["key"]>("cream")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = `metric=${metric}&theme=${theme}${shape === "wide" ? "" : `&shape=${shape}`}`
  const badgePath = `/badge/${encodeURIComponent(handle)}?${query}`
  const badgeUrl = `${origin}${badgePath}`
  const profileUrl = `${origin}/@${handle}`
  const alt = metric === "verified" ? "epic.li verified profile" : `epic.li verified ${METRIC_LABELS[metric]}`
  const teeStyle = TEES.find((item) => item.key === tee) ?? TEES[0]
  const merchQuery =
    `variant=merch&metric=${metric}&theme=${merchTheme}&layout=${merchLayout}&qr=${merchQr === "on" ? 1 : 0}` +
    (merchLayout === "chest" ? `&tone=${teeStyle.dark ? "dark" : "light"}` : "")
  const merchPath = `/badge/${encodeURIComponent(handle)}?${merchQuery}`

  async function exportPng(id: string, path: string, scale: number, name: string) {
    setBusy(id)
    setError(null)
    try {
      await rasterize(path, scale, name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-10">
      <section aria-labelledby="badge-heading" className="border-2 border-[#1c1c16] bg-[#fdf9f0] p-5 shadow-[6px_6px_0_#1c1c16] sm:p-7">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">// 01 Badge</p>
        <h2 id="badge-heading" className="mt-1 text-2xl font-black uppercase tracking-[-0.05em] sm:text-3xl">
          Live badge for your README, site, or email
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53614e]">
          The badge is an image served by epic.li. It always shows the latest numbers from your public profile, so it
          can&apos;t drift from the proof behind it. Clicking it opens your profile.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid content-start gap-5">
            <Choice
              legend="Show"
              value={metric}
              onChange={setMetric}
              options={metrics.map((key) => ({
                key,
                label: key === "verified" ? "Verified only" : `${METRIC_LABELS[key]} ${amounts[key] ?? ""}`.trim(),
              }))}
            />
            <Choice
              legend="Layout"
              value={shape}
              onChange={setShape}
              options={[
                { key: "wide", label: "Wide strip" },
                { key: "stacked", label: "Stacked" },
              ]}
            />
            <Choice
              legend="Style"
              value={theme}
              onChange={setTheme}
              options={BADGE_THEMES.map((key) => ({ key, label: key }))}
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={`${badgePath}&download=1`}
                className="inline-flex min-h-11 items-center border-2 border-[#1c1c16] bg-[#00e55b] px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Download SVG
              </a>
              <ActionButton
                busy={busy === "badge-png"}
                onClick={() => void exportPng("badge-png", badgePath, 4, `epicli-${handle}-${shape}-${metric}-${theme}.png`)}
              >
                Download PNG (4x)
              </ActionButton>
            </div>
          </div>

          <div>
            <div
              className="grid min-h-40 place-items-center border-2 border-[#1c1c16] p-6"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage: "linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,8px 8px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG endpoint, no optimisation wanted */}
              <img src={badgePath} alt={alt} className="h-auto max-w-full" />
            </div>
            <div className="mt-4 grid gap-3">
              <CopyBlock label="Markdown" value={`[![${alt}](${badgeUrl})](${profileUrl})`} />
              <CopyBlock label="HTML" value={`<a href="${profileUrl}"><img src="${badgeUrl}" alt="${alt}" height="${shape === "stacked" ? 72 : 36}"></a>`} />
              <CopyBlock label="Image URL" value={badgeUrl} />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="merch-heading" className="border-2 border-[#1c1c16] bg-[#f7f3ea] p-5 shadow-[6px_6px_0_#1c1c16] sm:p-7">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">// 02 Merch</p>
        <h2 id="merch-heading" className="mt-1 text-2xl font-black uppercase tracking-[-0.05em] sm:text-3xl">
          Wear the proof
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53614e]">
          Preview your artwork on a tee (a QR code that opens your profile is optional), then download a print-ready file or open a print sheet. epic.li doesn&apos;t sell
          or ship merch; take the file to any print-on-demand shop. The artwork is dated ({asOf}) so a printed number is
          never mistaken for a live one.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="grid place-items-center border-2 border-[#1c1c16] bg-white p-4">
            <TeeMockup
              fill={teeStyle.fill}
              dark={teeStyle.dark}
              artHref={merchPath}
              label={`T-shirt mockup with your ${alt} artwork`}
            />
          </div>

          <div className="grid content-start gap-5">
            <Choice
              legend="Shirt colour"
              value={tee}
              onChange={setTee}
              options={TEES.map((item) => ({ key: item.key, label: item.label }))}
            />
            <Choice
              legend="Print layout"
              value={merchLayout}
              onChange={setMerchLayout}
              options={[
                { key: "chest", label: "Chest badge" },
                { key: "card", label: "Full card" },
              ]}
            />
            {merchLayout === "card" ? (
              <Choice
                legend="Artwork style"
                value={merchTheme}
                onChange={setMerchTheme}
                options={BADGE_THEMES.map((key) => ({ key, label: key }))}
              />
            ) : null}
            <Choice
              legend="QR code"
              value={merchQr}
              onChange={setMerchQr}
              options={[
                { key: "on", label: "Add QR" },
                { key: "off", label: "No QR" },
              ]}
            />
            <div className="flex flex-wrap gap-3">
              <ActionButton
                busy={busy === "merch-png"}
                onClick={() => void exportPng("merch-png", merchPath, 4, `epicli-${handle}-print-${merchLayout}.png`)}
              >
                Print file (PNG, 3200px)
              </ActionButton>
              <a
                href={`${merchPath}&download=1`}
                className="inline-flex min-h-11 items-center border-2 border-[#1c1c16] bg-white px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] hover:bg-[#f2ede4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Vector (SVG)
              </a>
              <a
                href={`/@${handle}/badges/print?${merchQuery.replace("variant=merch&", "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center border-2 border-[#1c1c16] bg-[#00e55b] px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
              >
                Open print sheet ↗
              </a>
            </div>
            <p className="text-xs leading-5 text-[#66705f]">
              Text uses a generic monospace font. For a pixel-exact print, upload the SVG to a design tool and convert
              the text to outlines first.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
          {error}
        </p>
      ) : null}
    </div>
  )
}
