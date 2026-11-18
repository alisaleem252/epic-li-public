"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { ProviderLogo } from "@/components/marketing/provider-logo"
import { REVENUE_SOURCE_OPTIONS, type RevenueSourceId } from "@/lib/providers/registry"
import { cn } from "@/lib/utils"

type ProviderPickerProps = {
  value: RevenueSourceId
  onChange: (value: RevenueSourceId) => void
  disabled?: boolean
}

/** Accessible listbox dropdown (button + options) so every option can carry its logo. */
export function ProviderPicker({ value, onChange, disabled }: ProviderPickerProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const labelId = useId()
  const selectedIndex = Math.max(0, REVENUE_SOURCE_OPTIONS.findIndex((option) => option.id === value))
  const selected = REVENUE_SOURCE_OPTIONS[selectedIndex]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  function openList() {
    setActive(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    onChange(REVENUE_SOURCE_OPTIONS[index].id)
    setOpen(false)
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) return openList()
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive((current) => (current + step + REVENUE_SOURCE_OPTIONS.length) % REVENUE_SOURCE_OPTIONS.length)
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (open) choose(active)
      else openList()
    } else if (event.key === "Escape" && open) {
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <p id={labelId} className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
        1 · Payment gateway
      </p>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="mt-2 flex min-h-14 w-full items-center gap-3 border-2 border-[#1c1c16] bg-white px-3 text-left shadow-[4px_4px_0px_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] disabled:opacity-60"
      >
        <ProviderLogo id={selected.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{selected.name}</span>
          <span className="block truncate text-xs text-[#66705f]">{selected.shortDescription}</span>
        </span>
        <span aria-hidden="true" className={cn("font-mono text-xs transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute inset-x-0 z-20 mt-2 max-h-72 overflow-y-auto border-2 border-[#1c1c16] bg-white shadow-[5px_5px_0px_#1c1c16]"
        >
          {REVENUE_SOURCE_OPTIONS.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.id === value}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-[#1c1c16]/10 px-3 py-2 last:border-b-0",
                index === active && "bg-[#e7f6e7]",
              )}
            >
              <ProviderLogo id={option.id} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{option.name}</span>
                <span className="block truncate text-xs text-[#66705f]">{option.shortDescription}</span>
              </span>
              {option.id === value ? <span aria-hidden="true" className="font-mono text-xs text-[#087d32]">✓</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
