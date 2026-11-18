"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { CreateProfileForm } from "@/components/marketing/create-profile-form"
import { describeHandleProblem, HANDLE_MAX_LENGTH, sanitizeHandleInput } from "@/lib/handle"

type RemoteCheck =
  | { kind: "available" }
  | { kind: "taken"; published: boolean }
  | { kind: "reserved" }
  | { kind: "unavailable" }

type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid"; message: string }
  | RemoteCheck

const CHECK_DEBOUNCE_MS = 350

async function fetchAvailability(handle: string, signal: AbortSignal): Promise<RemoteCheck> {
  const response = await fetch(`/api/handles/${encodeURIComponent(handle)}`, {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!response.ok) return { kind: "unavailable" }

  const body: unknown = await response.json()
  const status = typeof body === "object" && body !== null ? (body as { status?: unknown }).status : null

  if (status === "available") return { kind: "available" }
  if (status === "reserved") return { kind: "reserved" }
  if (status === "taken") {
    return { kind: "taken", published: (body as { published?: unknown }).published === true }
  }
  return { kind: "unavailable" }
}

/**
 * The homepage's single action. It checks (but never reserves) a handle and then opens
 * the profile setup in a modal; nothing is saved until a read-only provider credential
 * has been verified. Without JavaScript it falls back to a plain GET form to /create.
 */
export function ClaimHandleForm() {
  const inputId = useId()
  const statusId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [handle, setHandle] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [remote, setRemote] = useState<{ handle: string; result: RemoteCheck } | null>(null)

  const problem = handle ? describeHandleProblem(handle) : null

  useEffect(() => {
    if (!handle || problem) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetchAvailability(handle, controller.signal)
        if (!controller.signal.aborted) setRemote({ handle, result })
      } catch {
        if (!controller.signal.aborted) setRemote({ handle, result: { kind: "unavailable" } })
      }
    }, CHECK_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [handle, problem])

  const check: Check = !handle
    ? { kind: "idle" }
    : problem
      ? { kind: "invalid", message: problem }
      : remote?.handle === handle
        ? remote.result
        : { kind: "checking" }

  const blocked = check.kind === "invalid" || check.kind === "taken" || check.kind === "reserved"

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!handle || blocked) {
      inputRef.current?.focus()
      return
    }
    setModalOpen(true)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (modalOpen && !dialog.open) dialog.showModal()
    if (!modalOpen && dialog.open) dialog.close()
    document.documentElement.style.overflow = modalOpen ? "hidden" : ""
    return () => {
      document.documentElement.style.overflow = ""
    }
  }, [modalOpen])

  return (
    <>
    <form
      action="/create"
      method="get"
      onSubmit={onSubmit}
      className="border-2 border-[#1c1c16] bg-[#fdf9f0] shadow-[8px_8px_0_#1c1c16]"
    >
      <div className="flex items-center justify-between gap-3 border-b-2 border-[#1c1c16] bg-[#1c1c16] px-3 py-1.5 text-[#fdf9f0]">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="text-[#00e55b]" aria-hidden="true">■ </span>
          claim_handle.exe
        </span>
        <span aria-hidden="true" className="flex items-center gap-1 font-mono text-[10px] leading-none">
          <span className="grid size-4 place-items-center border border-[#fdf9f0]/60">_</span>
          <span className="grid size-4 place-items-center border border-[#fdf9f0]/60">□</span>
          <span className="grid size-4 place-items-center border border-[#fdf9f0]/60 bg-[#ba1a1a]">×</span>
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <label htmlFor={inputId} className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#53614e]">
          Pick your public handle
        </label>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="flex min-w-0 flex-1 border-2 border-[#1c1c16] bg-white focus-within:ring-2 focus-within:ring-[#00b943] focus-within:ring-offset-2 focus-within:ring-offset-[#fdf9f0]">
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center border-r-2 border-[#1c1c16] bg-[#f2ede4] px-3 font-mono text-sm text-[#53614e] sm:text-base"
            >
              epic.li/@
            </span>
            <input
              ref={inputRef}
              id={inputId}
              name="handle"
              type="text"
              inputMode="text"
              value={handle}
              onChange={(event) => setHandle(sanitizeHandleInput(event.target.value))}
              maxLength={HANDLE_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="yourname"
              aria-describedby={statusId}
              aria-invalid={blocked || undefined}
              className="min-h-12 min-w-0 flex-1 bg-white px-3 py-3 font-mono text-base outline-none placeholder:text-[#9a9a8c] sm:text-lg"
            />
          </div>

          <button
            type="submit"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border-2 border-[#1c1c16] bg-[#00e55b] px-5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#1c1c16] shadow-[4px_4px_0_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#1c1c16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1c1c16] "
          >
            Claim handle
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <p
          id={statusId}
          role="status"
          aria-live="polite"
          className="mt-3 min-h-10 font-mono text-[11px] leading-5 sm:min-h-5"
        >
          <CheckMessage check={check} handle={handle} />
        </p>

        <p className="mt-3 border-t border-[#1c1c16]/20 pt-3 font-mono text-[10px] leading-relaxed text-[#53614e]">
          Nothing is saved or reserved yet. A handle is yours only after you connect a read-only key and it checks out.
        </p>
      </div>
    </form>

    <dialog
      ref={dialogRef}
      onClose={() => setModalOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setModalOpen(false)
      }}
      aria-label={`Claim epic.li/@${handle}`}
      className="m-auto max-h-[92vh] w-[min(100%-1rem,46rem)] overflow-y-auto bg-transparent p-0 backdrop:bg-[#1c1c16]/70 backdrop:backdrop-blur-sm"
    >
      {modalOpen ? (
        <div className="relative p-1">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="absolute right-4 top-4 z-10 grid size-9 place-items-center border-2 border-[#1c1c16] bg-white font-mono text-sm font-bold hover:bg-[#ffdad6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1c16]"
            aria-label="Close"
          >
            ×
          </button>
          <CreateProfileForm initialHandle={handle} inModal />
        </div>
      ) : null}
    </dialog>
    </>
  )
}

function CheckMessage({ check, handle }: { check: Check; handle: string }) {
  switch (check.kind) {
    case "idle":
      return (
        <span className="text-[#53614e]">
          Lowercase letters, numbers and hyphens, up to {HANDLE_MAX_LENGTH} characters.
        </span>
      )
    case "checking":
      return <span className="text-[#53614e]">Checking availability…</span>
    case "invalid":
      return <span className="font-bold text-[#ba1a1a]">✗ {check.message}</span>
    case "available":
      return <span className="font-bold text-[#087d32]">✓ epic.li/@{handle} is available</span>
    case "reserved":
      return <span className="font-bold text-[#ba1a1a]">✗ @{handle} is reserved. Try another handle.</span>
    case "taken":
      return (
        <span className="font-bold text-[#ba1a1a]">
          ✗ @{handle} is taken.
          {check.published ? (
            <>
              {" "}
              <Link
                href={`/@${handle}`}
                className="text-[#1c1c16] underline decoration-[#00b943] decoration-2 underline-offset-4"
              >
                View profile →
              </Link>
            </>
          ) : null}
        </span>
      )
    case "unavailable":
      return (
        <span className="text-[#53614e]">
          Couldn’t check availability right now. You can still continue; it is confirmed when the profile is created.
        </span>
      )
  }
}
