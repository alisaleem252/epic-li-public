import Link from "next/link"
import { GitPullRequest } from "lucide-react"

const navigation = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#permissions", label: "Permissions" },
  { href: "/demo", label: "Demo profile" },
]

export function SiteHeader() {
  return (
    <header className="border-b-2 border-[#1c1c16] bg-[#fdf9f0]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="epic.li home">
          <span className="grid size-10 shrink-0 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] font-mono text-xl font-bold shadow-[3px_3px_0px_#1c1c16]">
            E.
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-none tracking-[-0.06em]">epic.li</span>
            <span className="mt-1 hidden font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#53614e] sm:block">
              Public revenue profiles
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#53614e] transition-colors hover:text-[#1c1c16]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/alisaleem252/epic-li-public"
            target="_blank"
            rel="noreferrer"
            aria-label="Contribute to epic.li on GitHub"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 border-2 border-[#1c1c16] bg-white px-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] shadow-[3px_3px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] sm:px-3 sm:text-[10px]"
          >
            <GitPullRequest aria-hidden="true" className="size-4" />
            Contribute
          </a>
          <Link
            href="/create"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 border-2 border-[#1c1c16] bg-[#1c1c16] px-2 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-[#fdf9f0] shadow-[3px_3px_0px_#00e55b] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#00e55b] sm:gap-2 sm:px-4 sm:text-[10px] sm:tracking-[0.08em]"
          >
            <span className="sm:hidden">Create</span>
            <span className="hidden sm:inline">Create profile</span>
            <span aria-hidden="true" className="hidden sm:inline">→</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
