import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

/**
 * Decorative, blurred, drifting preview of what the leaderboard will look like.
 *
 * Every name, handle and number below is FICTIONAL. They exist only to suggest the
 * shape of a future leaderboard, are blurred past readability, hidden from assistive
 * tech, and flagged `data-illustrative`. They must never be presented
 * as real founders or real revenue. Real, verified profiles are rendered by
 * `FeaturedProfileCard`, never from this file.
 */

type Placement = Pick<CSSProperties, "left" | "right" | "top" | "bottom">

type Motion = {
  dx: number
  dy: number
  rot: number
  drot: number
  duration: number
  delay: number
}

type GhostBase = {
  id: string
  placement: Placement
  motion: Motion
  blur: number
  opacity: number
  /** Ghosts near the headline are hidden on small screens so text stays legible. */
  mobile?: boolean
}

type GhostCard = GhostBase & {
  kind: "card"
  tone: "light" | "dark"
  initials: string
  name: string
  handle: string
  mrr: string
  message: string
  bars: number[]
}

type GhostBadge = GhostBase & { kind: "badge"; label: string }

type GhostChip = GhostBase & { kind: "chip"; initials: string; total: string }

type Ghost = GhostCard | GhostBadge | GhostChip

const GHOSTS: Ghost[] = [
  {
    id: "acme",
    kind: "card",
    tone: "light",
    initials: "AI",
    name: "Acme Indie Co.",
    handle: "acme-indie",
    mrr: "$48.2K",
    message: "Shipped v2 this week. Churn is finally under 2%.",
    bars: [30, 36, 41, 52, 58, 70, 78],
    placement: { left: "1.5%", top: "7%" },
    motion: { dx: 26, dy: 18, rot: -3, drot: 2, duration: 26, delay: -4 },
    blur: 5,
    opacity: 0.8,
  },
  {
    id: "lorem",
    kind: "card",
    tone: "dark",
    initials: "LI",
    name: "Lorem Ipsum SaaS",
    handle: "lorem-saas",
    mrr: "$12.9K",
    message: "Year two. Still no investors, still shipping.",
    bars: [20, 28, 26, 38, 44, 52, 66],
    placement: { right: "1.5%", top: "5%" },
    motion: { dx: -22, dy: 24, rot: 2.5, drot: -2, duration: 31, delay: -11 },
    blur: 6,
    opacity: 0.75,
  },
  {
    id: "foobar",
    kind: "card",
    tone: "light",
    initials: "FB",
    name: "Foo Bar Labs",
    handle: "foobar-labs",
    mrr: "$3.4K",
    message: "First $3K month. Thank you to our first 80 customers.",
    bars: [10, 14, 18, 22, 30, 36, 44],
    placement: { left: "3%", bottom: "8%" },
    motion: { dx: 30, dy: -20, rot: 2, drot: -3, duration: 28, delay: -17 },
    blur: 5,
    opacity: 0.8,
    mobile: true,
  },
  {
    id: "pete",
    kind: "card",
    tone: "light",
    initials: "PP",
    name: "Placeholder Pete",
    handle: "pete-sample",
    mrr: "$91.7K",
    message: "Bootstrapped to ramen profitability, then past it.",
    bars: [44, 52, 58, 66, 72, 84, 92],
    placement: { right: "3%", bottom: "6%" },
    motion: { dx: -28, dy: -16, rot: -2, drot: 3, duration: 33, delay: -8 },
    blur: 6,
    opacity: 0.75,
    mobile: true,
  },
  {
    id: "example",
    kind: "card",
    tone: "light",
    initials: "EA",
    name: "Example Apps",
    handle: "example-apps",
    mrr: "$22.0K",
    message: "Small team, boring stack, steady growth.",
    bars: [26, 30, 34, 40, 46, 50, 58],
    placement: { left: "41%", bottom: "-5%" },
    motion: { dx: 18, dy: -22, rot: 1.5, drot: -2, duration: 29, delay: -13 },
    blur: 6,
    opacity: 0.7,
  },
  {
    id: "sample",
    kind: "card",
    tone: "light",
    initials: "SS",
    name: "Sample Studio",
    handle: "sample-studio",
    mrr: "$6.1K",
    message: "Solo founder. Day job quit last month.",
    bars: [12, 18, 22, 28, 30, 40, 46],
    placement: { left: "30%", top: "-7%" },
    motion: { dx: -16, dy: 20, rot: -1.5, drot: 2, duration: 35, delay: -2 },
    blur: 6,
    opacity: 0.65,
  },
  {
    id: "badge-1",
    kind: "badge",
    label: "$12.4K MRR",
    placement: { left: "16%", top: "5%" },
    motion: { dx: 20, dy: 14, rot: -4, drot: 3, duration: 22, delay: -6 },
    blur: 3,
    opacity: 0.85,
  },
  {
    id: "badge-2",
    kind: "badge",
    label: "$240K TOTAL",
    placement: { right: "17%", top: "10%" },
    motion: { dx: -18, dy: 16, rot: 3, drot: -3, duration: 24, delay: -15 },
    blur: 3,
    opacity: 0.85,
  },
  {
    id: "badge-3",
    kind: "badge",
    label: "$7.8K MRR",
    placement: { left: "19%", bottom: "4%" },
    motion: { dx: 24, dy: -12, rot: 3, drot: -2, duration: 25, delay: -9 },
    blur: 2.5,
    opacity: 0.9,
    mobile: true,
  },
  {
    id: "badge-4",
    kind: "badge",
    label: "$1.2M TOTAL",
    placement: { right: "20%", bottom: "5%" },
    motion: { dx: -22, dy: -14, rot: -3, drot: 3, duration: 27, delay: -19 },
    blur: 2.5,
    opacity: 0.9,
    mobile: true,
  },
  {
    id: "chip-1",
    kind: "chip",
    initials: "NL",
    total: "$318K",
    placement: { left: "0.5%", top: "46%" },
    motion: { dx: 14, dy: 26, rot: 0, drot: 0, duration: 30, delay: -5 },
    blur: 3.5,
    opacity: 0.85,
  },
  {
    id: "chip-2",
    kind: "chip",
    initials: "QZ",
    total: "$86K",
    placement: { right: "0.5%", top: "50%" },
    motion: { dx: -14, dy: -24, rot: 0, drot: 0, duration: 32, delay: -21 },
    blur: 3.5,
    opacity: 0.85,
  },
]

function GhostCardView({ ghost }: { ghost: GhostCard }) {
  const dark = ghost.tone === "dark"
  return (
    <div
      className={cn(
        "w-60 border-2 border-[#1c1c16] p-3 shadow-[5px_5px_0_#1c1c16]",
        dark ? "bg-[#101712] text-[#e5f4e7]" : "bg-white text-[#1c1c16]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] text-xs font-black text-[#1c1c16]">
          {ghost.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-[-0.03em]">{ghost.name}</p>
          <p className={cn("font-mono text-[10px]", dark ? "text-[#a9b7aa]" : "text-[#53614e]")}>@{ghost.handle}</p>
        </div>
        <span className="ml-auto border border-[#1c1c16] bg-[#00e55b] px-1 font-mono text-[10px] font-bold text-[#1c1c16]">
          ✓
        </span>
      </div>
      <p className={cn("mt-3 font-mono text-2xl font-bold", dark && "text-[#00e55b]")}>
        {ghost.mrr} <span className="text-[10px] font-normal uppercase">MRR</span>
      </p>
      <p className={cn("mt-2 text-[11px] leading-snug", dark ? "text-[#c6d2c7]" : "text-[#3d3d35]")}>“{ghost.message}”</p>
      <div className="mt-3 flex h-8 items-end gap-1">
        {ghost.bars.map((height, index) => (
          <span
            key={index}
            className="flex-1 border border-[#1c1c16]/60 bg-[#00e55b]/80"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function GhostBadgeView({ ghost }: { ghost: GhostBadge }) {
  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap border-2 border-[#1c1c16] bg-[#fdf9f0] px-3 py-1.5 font-mono text-[11px] font-bold shadow-[3px_3px_0_#1c1c16]">
      <span className="bg-[#00e55b] px-1">✓</span>
      <span>VERIFIED</span>
      <span className="text-[#087d32]">{ghost.label}</span>
      <span className="text-[#53614e]">epic.li</span>
    </div>
  )
}

function GhostChipView({ ghost }: { ghost: GhostChip }) {
  return (
    <div className="inline-flex items-center gap-2 border-2 border-[#1c1c16] bg-white p-1.5 pr-3 shadow-[3px_3px_0_#1c1c16]">
      <span className="grid size-8 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] text-[11px] font-black">
        {ghost.initials}
      </span>
      <span className="font-mono text-sm font-bold">{ghost.total}</span>
    </div>
  )
}

export function ClaimBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-illustrative="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      {/* Faint retro dot grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(#1c1c16 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {GHOSTS.map((ghost) => {
        const motionVars = {
          "--dx": `${ghost.motion.dx}px`,
          "--dy": `${ghost.motion.dy}px`,
          "--rot": `${ghost.motion.rot}deg`,
          "--drot": `${ghost.motion.drot}deg`,
          "--dur": `${ghost.motion.duration}s`,
          "--delay": `${ghost.motion.delay}s`,
          ...ghost.placement,
        } as CSSProperties

        return (
          <div
            key={ghost.id}
            className={cn("epic-drift absolute", !ghost.mobile && "max-sm:hidden")}
            style={motionVars}
          >
            <div style={{ filter: `blur(${ghost.blur}px)`, opacity: ghost.opacity }}>
              {ghost.kind === "card" ? <GhostCardView ghost={ghost} /> : null}
              {ghost.kind === "badge" ? <GhostBadgeView ghost={ghost} /> : null}
              {ghost.kind === "chip" ? <GhostChipView ghost={ghost} /> : null}
            </div>
          </div>
        )
      })}

      {/* Fades the middle so the headline and form stay readable over the drifting layer */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 58% at 50% 46%, #fdf9f0 0%, rgba(253,249,240,0.92) 38%, rgba(253,249,240,0) 100%)",
        }}
      />
    </div>
  )
}
