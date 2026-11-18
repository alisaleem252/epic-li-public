import { cn } from "@/lib/utils"
import {
  REQUIRED_STRIPE_PERMISSIONS,
  STRIPE_CHARGE_DATA_NOTICE,
  STRIPE_PERMISSION_AUDIT_NOTICE,
} from "@/lib/stripe-permissions"

type ScopeManifestProps = {
  demo?: boolean
  inverse?: boolean
}

export function ScopeManifest({ demo = false, inverse = false }: ScopeManifestProps) {
  return (
    <section
      aria-labelledby="scope-manifest-title"
      className={cn(
        "border-2 p-5 sm:p-6",
        inverse
          ? "border-[#00e55b]/50 bg-[#101712] text-[#e3f3e5]"
          : "border-[#1c1c16] bg-[#fdf9f0] text-[#1c1c16] shadow-[5px_5px_0px_#1c1c16]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-current/20 pb-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">
            // Stripe restricted key
          </p>
          <h2 id="scope-manifest-title" className="mt-1 text-xl font-bold tracking-[-0.04em]">
            Requested permission set
          </h2>
        </div>
        <span
          className={cn(
            "border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.08em]",
            inverse
              ? "border-[#00e55b]/50 bg-[#00e55b]/10 text-[#9dffb4]"
              : "border-[#1c1c16] bg-[#e7f6e7] text-[#086b2b]",
          )}
        >
          {demo ? "Demo / not verified" : "Preset from Stripe URL"}
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Requested Stripe read permissions">
        {REQUIRED_STRIPE_PERMISSIONS.map((permission) => (
          <li
            key={permission.key}
            className={cn(
              "flex min-w-0 items-center justify-between gap-3 border px-3 py-2.5 font-mono text-[10px]",
              inverse ? "border-white/15 bg-white/[0.03]" : "border-[#1c1c16]/20 bg-white/70",
            )}
          >
            <span className="min-w-0 flex-1 break-all leading-4">{permission.key}</span>
            <span className="shrink-0 font-bold text-[#087d32]">READ</span>
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "mt-4 grid gap-3 border-t pt-4 font-mono text-[10px] leading-relaxed",
          inverse ? "border-white/15 text-[#b8c6ba]" : "border-[#1c1c16]/20 text-[#53614e]",
        )}
      >
        <p>{STRIPE_PERMISSION_AUDIT_NOTICE}</p>
        <p>{STRIPE_CHARGE_DATA_NOTICE}</p>
      </div>
    </section>
  )
}
