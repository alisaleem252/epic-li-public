import { getProviderDefinition, getRevenueSourceName, type RevenueSourceId } from "@/lib/providers/registry"
import { STRIPE_RESTRICTED_KEY_URL, STRIPE_SETUP_STEPS } from "@/lib/stripe-permissions"

/**
 * The whole box is one link: clicking anywhere opens the provider's key-creation page
 * in a new tab. The steps are inside it so the instructions and the action stay together.
 */
export function KeySetupBox({ sourceId }: { sourceId: RevenueSourceId }) {
  const isStripe = sourceId === "stripe"
  const provider = isStripe ? null : getProviderDefinition(sourceId)
  const href = isStripe ? STRIPE_RESTRICTED_KEY_URL : provider!.docsUrl
  const steps = isStripe ? STRIPE_SETUP_STEPS : provider!.setupSteps
  const note = isStripe ? null : provider!.permissionsNote
  const name = getRevenueSourceName(sourceId)

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group block border-2 border-[#1c1c16] bg-[#f7f3ea] p-4 shadow-[5px_5px_0px_#00e55b] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0px_#00e55b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] sm:p-5"
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#087d32]">
            2 · Create your read-only key
          </span>
          <span className="mt-1 block text-xl font-black uppercase leading-none tracking-[-0.05em] sm:text-2xl">
            Open {name} and create the key
          </span>
        </span>
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center border-2 border-[#1c1c16] bg-[#00e55b] text-lg font-bold transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        >
          ↗
        </span>
      </span>
      <ol className="mt-4 grid gap-2 text-sm leading-5 text-[#3c4638]">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="font-mono text-[10px] font-bold text-[#087d32]">0{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {note ? (
        <span className="mt-3 block border-t border-[#1c1c16]/15 pt-3 text-xs leading-5 text-[#66705f]">{note}</span>
      ) : null}
      <span className="mt-3 block font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#53614e]">
        Opens in a new tab · the whole box is a link
      </span>
    </a>
  )
}
