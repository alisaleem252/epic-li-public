"use client"

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 border-2 border-[#1c1c16] bg-[#00e55b] px-5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16]"
    >
      Print
    </button>
  )
}
