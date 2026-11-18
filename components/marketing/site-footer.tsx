import Image from "next/image"
import Link from "next/link"

const authorAvatarSrc =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/portrait1-white-5ACQxXZrevV2JAsZ7E15Uq0HTvDxgQ.png"

type SiteFooterProps = {
  brand?: string
  note?: string
  tone?: "light" | "dark"
}

export function SiteFooter({
  brand = "epic.li // truth over hype",
  note = "Each provider remains the source of permission truth.",
  tone = "light",
}: SiteFooterProps) {
  const theme =
    tone === "dark"
      ? {
          footer: "bg-[#1c1c16] text-[#fdf9f0]",
          muted: "text-[#c6d2c7]",
        }
      : {
          footer: "bg-[#e6e2d9] text-[#1c1c16]",
          muted: "text-[#53614e]",
        }

  return (
    <footer className={`border-t-2 border-[#1c1c16] px-5 py-5 sm:px-8 ${theme.footer}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Image
            src={authorAvatarSrc}
            alt="Portrait of Ali Saleem"
            width={48}
            height={48}
            sizes="48px"
            className="size-12 shrink-0 rounded-full border-2 border-[#00e55b] bg-black object-cover"
          />
          <div>
            <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${theme.muted}`}>
              Built by
            </p>
            <p className="mt-0.5 text-sm font-bold uppercase tracking-[-0.03em]">Ali Saleem</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em]">{brand}</p>
          <p className={`font-mono text-[9px] leading-relaxed ${theme.muted}`}>{note}</p>
          <nav aria-label="Legal" className="flex gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
            <Link href="/terms" className="underline">Terms</Link>
            <Link href="/privacy" className="underline">Privacy</Link>
            <Link href="/cookies" className="underline">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
