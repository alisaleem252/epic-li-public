/**
 * Pure SVG builders for epic.li badges and the merch artwork. No fonts or images are
 * embedded: text uses the viewer's monospace, widths are estimated from character count so
 * the output is a single dependency-free file that works in <img>, README files, and print.
 */

export const BADGE_METRICS = ["mrr", "revenue30", "total", "verified"] as const
export const BADGE_THEMES = ["light", "dark", "green"] as const

export type BadgeMetric = (typeof BADGE_METRICS)[number]
export type BadgeTheme = (typeof BADGE_THEMES)[number]

export const METRIC_LABELS: Record<BadgeMetric, string> = {
  mrr: "MRR",
  revenue30: "30D REVENUE",
  total: "TOTAL REVENUE",
  verified: "VERIFIED",
}

export function isBadgeMetric(value: unknown): value is BadgeMetric {
  return typeof value === "string" && (BADGE_METRICS as readonly string[]).includes(value)
}

export function isBadgeTheme(value: unknown): value is BadgeTheme {
  return typeof value === "string" && (BADGE_THEMES as readonly string[]).includes(value)
}

const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
const INK = "#1c1c16"
const CREAM = "#fdf9f0"
const GREEN = "#00e55b"

const PALETTE: Record<BadgeTheme, { bg: string; text: string; accent: string; leftBg: string; leftText: string }> = {
  light: { bg: CREAM, text: INK, accent: "#087d32", leftBg: GREEN, leftText: INK },
  dark: { bg: INK, text: CREAM, accent: GREEN, leftBg: GREEN, leftText: INK },
  green: { bg: GREEN, text: INK, accent: INK, leftBg: INK, leftText: GREEN },
}

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      default:
        return "&#39;"
    }
  })
}

export function formatBadgeMoney(value: number, currency: string) {
  const code = /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : "USD"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 0 : 1,
  }).format(value)
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export type BadgeInput = {
  handle: string
  /** Pre-formatted amount, e.g. "$12.4K". Null renders the plain "verified" badge. */
  amount: string | null
  metric: BadgeMetric
  theme: BadgeTheme
}

/** Compact one-line badge: [✓ VERIFIED | $12.4K MRR | @handle]. */
export function buildBadgeSvg({ handle, amount, metric, theme }: BadgeInput) {
  const colors = PALETTE[theme]
  const charWidth = 7.4
  const pad = 11
  const height = 34
  const shadow = 3

  const left = "✓ VERIFIED"
  const middle = amount && metric !== "verified" ? `${amount} ${METRIC_LABELS[metric]}` : null
  const right = `epic.li/@${truncate(handle, 18)}`

  const leftW = Math.ceil(left.length * charWidth + pad * 2)
  const middleW = middle ? Math.ceil(middle.length * charWidth + pad * 2) : 0
  const rightW = Math.ceil(right.length * charWidth + pad * 2)
  const width = leftW + middleW + rightW
  const label = middle ? `epic.li verified ${METRIC_LABELS[metric]} ${amount} for @${handle}` : `epic.li verified profile @${handle}`

  const text = (x: number, value: string, fill: string, weight = 700) =>
    `<text x="${x}" y="${height / 2 + 4}" fill="${fill}" font-family="${FONT}" font-size="12" font-weight="${weight}" letter-spacing="0.4">${escapeXml(value)}</text>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width + shadow}" height="${height + shadow}" viewBox="0 0 ${width + shadow} ${height + shadow}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<rect x="${shadow}" y="${shadow}" width="${width}" height="${height}" fill="${INK}"/>`,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="${colors.bg}" stroke="${INK}" stroke-width="2"/>`,
    `<rect x="2" y="2" width="${leftW - 2}" height="${height - 4}" fill="${colors.leftBg}"/>`,
    text(pad, left, colors.leftText),
    middle ? text(leftW + pad, middle, colors.text) : "",
    middle ? `<rect x="${leftW}" y="2" width="1.5" height="${height - 4}" fill="${INK}" opacity="0.25"/>` : "",
    `<rect x="${leftW + middleW}" y="2" width="1.5" height="${height - 4}" fill="${INK}" opacity="0.25"/>`,
    text(leftW + middleW + pad, right, colors.accent, 600),
    `</svg>`,
  ]
    .filter(Boolean)
    .join("")
}

export const BADGE_SHAPES = ["wide", "stacked"] as const
export type BadgeShape = (typeof BADGE_SHAPES)[number]

export function isBadgeShape(value: unknown): value is BadgeShape {
  return typeof value === "string" && (BADGE_SHAPES as readonly string[]).includes(value)
}

/** Compact vertical badge: green VERIFIED pill, big @handle, optional amount, EPIC.LI wordmark. */
export function buildStackedBadgeSvg({ handle, amount, metric, theme }: BadgeInput) {
  const colors = PALETTE[theme]
  const shadow = 4
  const pad = 20
  const handleText = `@${truncate(handle, 16)}`
  const pill = "✓ VERIFIED"
  const middle = amount && metric !== "verified" ? `${amount} ${METRIC_LABELS[metric]}` : null
  const handleSize = 38
  const pillW = Math.ceil(pill.length * 8.6 + 28)
  const contentW = Math.max(pillW, Math.ceil(handleText.length * handleSize * 0.6), middle ? Math.ceil(middle.length * 8.6) : 0)
  const width = Math.max(190, contentW + pad * 2)
  const height = middle ? 176 : 150
  const label = middle ? `epic.li verified ${METRIC_LABELS[metric]} ${amount} for @${handle}` : `epic.li verified profile @${handle}`
  const t = (y: number, size: number, fill: string, value: string, weight = 800, spacing = 0) =>
    `<text x="${pad}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${escapeXml(value)}</text>`
  const handleY = 90
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width + shadow}" height="${height + shadow}" viewBox="0 0 ${width + shadow} ${height + shadow}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<rect x="${shadow}" y="${shadow}" width="${width}" height="${height}" fill="${INK}"/>`,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="${colors.bg}" stroke="${INK}" stroke-width="2"/>`,
    `<rect x="${pad}" y="18" width="${pillW}" height="30" fill="${colors.leftBg}" stroke="${INK}" stroke-width="2"/>`,
    `<text x="${pad + 14}" y="38" fill="${colors.leftText}" font-family="${FONT}" font-size="13" font-weight="800" letter-spacing="0.6">${pill}</text>`,
    t(handleY, handleSize, colors.text, handleText, 800, -1),
    middle ? t(handleY + 24, 14, colors.text, middle, 700, 0.4) : "",
    t(height - 20, 17, colors.accent, "EPIC.LI", 800, 2),
    `</svg>`,
  ]
    .filter(Boolean)
    .join("")
}

export type MerchInput = {
  handle: string
  amount: string | null
  metric: BadgeMetric
  theme: BadgeTheme
  /** Human date the number was read, e.g. "Nov 5, 2026". Printed on the artwork so it can't pass as a live figure. */
  asOf: string
  /** Absolute profile URL the QR code points to and the printed address is derived from. */
  profileUrl: string
  /** QR module matrix for `profileUrl` (true = dark). Omit to leave the QR out. */
  qr?: boolean[][] | null
}

function displayAddress(profileUrl: string, handle: string) {
  try {
    return `${new URL(profileUrl).host}/@${truncate(handle, 24)}`
  } catch {
    return `epic.li/@${truncate(handle, 24)}`
  }
}

export type ChestInput = {
  handle: string
  amount: string | null
  metric: BadgeMetric
  /** true when printing on a dark shirt (cream text), false for light shirts (ink text). */
  onDark: boolean
  asOf: string
  profileUrl: string
  qr?: boolean[][] | null
}

/** Frameless chest print: VERIFIED pill, @handle, optional amount, EPIC.LI, optional QR. Transparent background. */
export function buildChestSvg({ handle, amount, metric, onDark, asOf, qr }: ChestInput) {
  const size = 800
  const text = onDark ? CREAM : INK
  const accent = onDark ? GREEN : "#087d32"
  const handleText = `@${truncate(handle, 16)}`
  const hasAmount = Boolean(amount && metric !== "verified")
  const handleSize = Math.min(150, Math.floor(500 / Math.max(4, handleText.length * 0.6)))
  const pill = "✓ VERIFIED"
  const pillSize = 34
  const pillW = Math.ceil(pill.length * pillSize * 0.62 + 56)
  const pillH = 64
  const blockW = Math.max(pillW, Math.ceil(handleText.length * handleSize * 0.6))
  const left = Math.round((size - blockW) / 2)
  const qrSide = 200
  const hasQr = Boolean(qr && qr.length > 0)

  const amountBlock = hasAmount ? 64 : 0
  const gap1 = 28
  const wordmark = 64
  const qrBlock = hasQr ? 36 + qrSide + 40 : 0
  const total = pillH + gap1 + handleSize + amountBlock + 22 + wordmark + qrBlock
  let y = Math.round((size - total) / 2)

  const parts: string[] = []
  parts.push(`<rect x="${left}" y="${y}" width="${pillW}" height="${pillH}" fill="${GREEN}"${onDark ? "" : ` stroke="${INK}" stroke-width="4"`}/>`)
  parts.push(`<text x="${left + 28}" y="${y + 43}" fill="${INK}" font-family="${FONT}" font-size="${pillSize}" font-weight="800" letter-spacing="1.5">${pill}</text>`)
  y += pillH + gap1 + Math.round(handleSize * 0.8)
  parts.push(`<text x="${left}" y="${y}" fill="${text}" font-family="${FONT}" font-size="${handleSize}" font-weight="800" letter-spacing="-3">${escapeXml(handleText)}</text>`)
  if (hasAmount) {
    y += 40
    parts.push(`<text x="${left}" y="${y}" fill="${text}" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="1">${escapeXml(`${amount} ${METRIC_LABELS[metric]}`)}</text>`)
    y += 24
    parts.push(`<text x="${left}" y="${y}" fill="${text}" opacity="0.7" font-family="${FONT}" font-size="18" font-weight="600" letter-spacing="1">${escapeXml(`AS OF ${asOf.toUpperCase()}`)}</text>`)
  }
  y += 22 + 48
  parts.push(`<text x="${left}" y="${y}" fill="${accent}" font-family="${FONT}" font-size="46" font-weight="800" letter-spacing="5">EPIC.LI</text>`)

  if (hasQr && qr) {
    const bx = Math.round((size - qrSide) / 2)
    const by = y + 36
    const pad = 14
    const modules = qr.length
    const cell = (qrSide - pad * 2) / modules
    const path: string[] = []
    qr.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) path.push(`M${(bx + pad + c * cell).toFixed(2)} ${(by + pad + r * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`)
      }),
    )
    parts.push(`<rect x="${bx}" y="${by}" width="${qrSide}" height="${qrSide}" fill="#ffffff"/>`)
    parts.push(`<path d="${path.join("")}" fill="${INK}" shape-rendering="crispEdges"/>`)
  }

  const ariaLabel = hasAmount ? `epic.li verified ${METRIC_LABELS[metric]} ${amount} for ${handleText}, as of ${asOf}` : `epic.li verified profile ${handleText}`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeXml(ariaLabel)}">`,
    `<title>${escapeXml(ariaLabel)}</title>`,
    `<g transform="translate(400 400) scale(${Math.min(1.4, 720 / total).toFixed(3)}) translate(-400 -400)">`,
    ...parts,
    `</g>`,
    `</svg>`,
  ].join("")
}

/** Square print artwork for apparel and posters (800x800, transparent outside the frame). */
export function buildMerchSvg({ handle, amount, metric, theme, asOf, profileUrl, qr }: MerchInput) {
  const colors = PALETTE[theme]
  const size = 800
  const hasAmount = Boolean(amount && metric !== "verified")
  const big = hasAmount ? (amount as string) : "✓"
  const fontSize = Math.min(220, Math.floor(620 / Math.max(2, big.length * 0.62)))
  const label = hasAmount ? METRIC_LABELS[metric] : "VERIFIED PROFILE"
  const handleText = `@${truncate(handle, 20)}`
  const address = displayAddress(profileUrl, handle)
  const ariaLabel = hasAmount
    ? `epic.li verified ${METRIC_LABELS[metric]} ${amount} for ${handleText}, as of ${asOf}`
    : `epic.li verified profile ${handleText}`

  // QR sits in a white box (its own quiet zone) bottom-right, so it scans on every theme.
  const box = { x: 506, y: 474, side: 200, pad: 16 }
  let qrMarkup = ""
  if (qr && qr.length > 0) {
    const modules = qr.length
    const cell = (box.side - box.pad * 2) / modules
    const path: string[] = []
    qr.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) {
          const x = (box.x + box.pad + c * cell).toFixed(2)
          const y = (box.y + box.pad + r * cell).toFixed(2)
          path.push(`M${x} ${y}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`)
        }
      }),
    )
    qrMarkup = [
      `<rect x="${box.x}" y="${box.y}" width="${box.side}" height="${box.side}" fill="#ffffff" stroke="${INK}" stroke-width="6"/>`,
      `<path d="${path.join("")}" fill="${INK}" shape-rendering="crispEdges"/>`,
      `<text x="${box.x + box.side / 2}" y="${box.y + box.side + 30}" text-anchor="middle" fill="${colors.text}" font-family="${FONT}" font-size="18" font-weight="800" letter-spacing="3">SCAN TO VERIFY</text>`,
    ].join("")
  }
  const textLeft = qrMarkup ? 76 : 390
  const anchor = qrMarkup ? "start" : "middle"

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeXml(ariaLabel)}">`,
    `<title>${escapeXml(ariaLabel)}</title>`,
    `<rect x="44" y="44" width="720" height="720" fill="${INK}"/>`,
    `<rect x="30" y="30" width="720" height="720" fill="${colors.bg}" stroke="${INK}" stroke-width="10"/>`,
    `<rect x="30" y="30" width="720" height="96" fill="${colors.leftBg}" stroke="${INK}" stroke-width="10"/>`,
    `<text x="76" y="92" fill="${colors.leftText}" font-family="${FONT}" font-size="34" font-weight="800" letter-spacing="3">✓ VERIFIED ON EPIC.LI</text>`,
    `<text x="390" y="${hasAmount ? 340 : 360}" text-anchor="middle" fill="${colors.text}" font-family="${FONT}" font-size="${fontSize}" font-weight="800" letter-spacing="-6">${escapeXml(big)}</text>`,
    `<text x="390" y="412" text-anchor="middle" fill="${colors.accent}" font-family="${FONT}" font-size="40" font-weight="800" letter-spacing="6">${escapeXml(label)}</text>`,
    `<rect x="76" y="444" width="628" height="6" fill="${INK}"/>`,
    `<text x="${textLeft}" y="540" text-anchor="${anchor}" fill="${colors.text}" font-family="${FONT}" font-size="44" font-weight="800">${escapeXml(handleText)}</text>`,
    `<text x="${textLeft}" y="584" text-anchor="${anchor}" fill="${colors.text}" font-family="${FONT}" font-size="22" font-weight="600" opacity="0.85">${escapeXml(address)}</text>`,
    `<text x="${textLeft}" y="${qrMarkup ? 648 : 640}" text-anchor="${anchor}" fill="${colors.text}" font-family="${FONT}" font-size="19" font-weight="600" opacity="0.7">${hasAmount ? `As of ${escapeXml(asOf)}` : "Read-only provider data"}</text>`,
    `<text x="${textLeft}" y="${qrMarkup ? 676 : 668}" text-anchor="${anchor}" fill="${colors.text}" font-family="${FONT}" font-size="19" font-weight="600" opacity="0.7">${hasAmount ? "Read-only provider data" : ""}</text>`,
    qrMarkup,
    `</svg>`,
  ].join("")
}
