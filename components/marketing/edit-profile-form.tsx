"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { ProfileFields } from "@/components/marketing/profile-fields"
import { ShowcaseEditor } from "@/components/marketing/showcase-editor"
import type { VerifiedCredentialProof } from "@/lib/credential-proof"
import { getProviderDefinition, type RevenueSourceId } from "@/lib/providers/registry"
import type { ProfileFieldsValue } from "@/lib/profile-links"

type ApiResponse = {
  error?: string
  message?: string
  retryAfterSeconds?: number
  profilePath?: string
  handle?: string
}

type RawPayloadResponse = ApiResponse & {
  provider?: string
  providerName?: string
  fetchedAt?: string
  payload?: unknown
}

type FormResult =
  | { kind: "error"; message: string }
  | { kind: "success"; profilePath: string; handle: string }
  | null

type PayloadViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; providerName: string; fetchedAt: string; payload: unknown }
  | null

type ResyncResponse = ApiResponse & {
  providerId?: string
  resyncedAt?: string
  counts?: {
    snapshots?: number
    products?: number
    plans?: number
    chargeEvents?: number
  }
}

type ResyncResult =
  | { kind: "success"; resyncedAt: string; counts: NonNullable<ResyncResponse["counts"]> }
  | { kind: "error"; message: string }
  | null

type EditProfileFormProps = {
  initialValues: ProfileFieldsValue
  providerId: RevenueSourceId
  verifiedProof: VerifiedCredentialProof
}

function errorMessage(data: ApiResponse | null) {
  if (data?.error === "key_mismatch") {
    return "That secret does not match the credentials used to create this profile."
  }
  if (data?.error === "handle_taken") return "That handle is already in use. Choose another one."
  if (data?.error === "invalid_key_format") {
    return "Enter the same live restricted key used to create this profile."
  }
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many attempts. Wait before trying again."
  }
  if (data?.error === "invalid_provider_credentials") {
    return "Enter the same secret originally connected to this profile."
  }
  if (data?.error === "rate_limit_unavailable" || data?.error === "encryption_unavailable") {
    return "Secure profile editing is temporarily unavailable. Please try again later."
  }
  return data?.message ?? "The profile could not be updated. Please check the form and try again."
}

function payloadErrorMessage(data: RawPayloadResponse | null) {
  if (data?.error === "key_mismatch") {
    return "That secret does not match the credentials used to create this profile."
  }
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many attempts. Wait before trying again."
  }
  if (data?.error === "payload_not_found") {
    return "No raw provider payload is stored for this profile yet."
  }
  if (data?.error === "payload_unavailable") {
    return "The stored raw payload could not be decrypted. Please try again later."
  }
  if (data?.error === "rate_limit_unavailable" || data?.error === "encryption_unavailable") {
    return "Secure payload access is temporarily unavailable. Please try again later."
  }
  return data?.message ?? "The raw provider payload could not be loaded."
}

function resyncErrorMessage(data: ResyncResponse | null) {
  if (data?.error === "key_mismatch") {
    return "That secret does not match the credentials used to create this profile."
  }
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many resync attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many resync attempts. Wait before trying again."
  }
  if (data?.error === "sync_limit_exceeded") {
    return "The sync exceeded the safe record limit. Try again later."
  }
  if (data?.error === "provider_auth_failed") {
    return "The provider rejected the stored credentials. Check the provider key and try again."
  }
  if (data?.error === "provider_unavailable" || data?.error === "stripe_unavailable") {
    return "The provider could not complete the sync. Please try again later."
  }
  if (data?.error === "rate_limit_unavailable" || data?.error === "encryption_unavailable") {
    return "Secure data resync is temporarily unavailable. Please try again later."
  }
  return data?.message ?? "The latest provider data could not be synced."
}

export function EditProfileForm({ initialValues, providerId, verifiedProof }: EditProfileFormProps) {
  const [profileFields, setProfileFields] = useState<ProfileFieldsValue>(() => ({
    ...initialValues,
    socialLinks: { ...initialValues.socialLinks },
  }))
  const [profileHandle, setProfileHandle] = useState(initialValues.handle)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<FormResult>(null)
  const [payloadState, setPayloadState] = useState<PayloadViewState>(null)
  const [pendingPayload, setPendingPayload] = useState(false)
  const [payloadCopied, setPayloadCopied] = useState(false)
  const [pendingResync, setPendingResync] = useState(false)
  const [resyncResult, setResyncResult] = useState<ResyncResult>(null)
  const providerName = providerId === "stripe" ? "Stripe" : getProviderDefinition(providerId).name

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || pendingPayload || pendingResync) return

    setPending(true)
    setResult(null)

    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profileHandle)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...profileFields, ...verifiedProof }),
      })
      const data = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !data?.profilePath || !data.handle) {
        setResult({ kind: "error", message: errorMessage(data) })
        return
      }

      setProfileHandle(data.handle)
      setResult({ kind: "success", profilePath: data.profilePath, handle: data.handle })
    } catch {
      setResult({
        kind: "error",
        message: "The request could not reach epic.li. The key was cleared from this form; please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  async function handleViewPayload() {
    if (pending || pendingPayload || pendingResync) return

    setPendingPayload(true)
    setPayloadState({ kind: "loading" })
    setPayloadCopied(false)

    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profileHandle)}/payload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(verifiedProof),
      })
      const data = (await response.json().catch(() => null)) as RawPayloadResponse | null

      if (!response.ok || data?.payload === undefined) {
        setPayloadState({ kind: "error", message: payloadErrorMessage(data) })
        return
      }

      setPayloadState({
        kind: "success",
        providerName: data.providerName ?? providerName,
        fetchedAt: data.fetchedAt ?? "",
        payload: data.payload,
      })
    } catch {
      setPayloadState({
        kind: "error",
        message: "The raw payload request could not reach epic.li. Please try again.",
      })
    } finally {
      setPendingPayload(false)
    }
  }

  async function handleCopyPayload() {
    if (payloadState?.kind !== "success") return
    try {
      await navigator.clipboard.writeText(JSON.stringify(payloadState.payload, null, 2))
      setPayloadCopied(true)
    } catch {
      setPayloadCopied(false)
    }
  }

  async function handleResync() {
    if (pending || pendingPayload || pendingResync) return

    setPendingResync(true)
    setResyncResult(null)

    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(profileHandle)}/resync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(verifiedProof),
      })
      const data = (await response.json().catch(() => null)) as ResyncResponse | null

      if (!response.ok || !data?.resyncedAt) {
        setResyncResult({ kind: "error", message: resyncErrorMessage(data) })
        return
      }

      setResyncResult({
        kind: "success",
        resyncedAt: data.resyncedAt,
        counts: data.counts ?? {},
      })
    } catch {
      setResyncResult({
        kind: "error",
        message: "The resync request could not reach epic.li. Please try again.",
      })
    } finally {
      setPendingResync(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-2 border-[#1c1c16] bg-white p-5 shadow-[6px_6px_0px_#1c1c16] sm:p-7"
      aria-busy={pending || pendingPayload || pendingResync}
    >
      <div className="border-b-2 border-[#1c1c16] pb-4">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#087d32]">
          // Profile editor
        </p>
        <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.06em]">Edit your page</h2>
        <p className="mt-2 text-sm leading-6 text-[#53614e]">
          Ownership is verified for this session. You can change the handle, profile details, and links. Saves use the same {providerName} credential and are checked server-side.
        </p>
      </div>

      <ProfileFields
        prefix="edit-profile"
        values={profileFields}
        onChange={setProfileFields}
        disabled={pending || pendingResync}
      />

      {result?.kind === "error" && (
        <p role="alert" className="mt-4 border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
          {result.message}
        </p>
      )}

      {result?.kind === "success" && (
        <div role="status" className="mt-4 border-2 border-[#1c1c16] bg-[#e7f6e7] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#087d32]">Profile updated</p>
          <p className="mt-1 text-sm">Your public profile changes are live.</p>
          <Link
            href={result.profilePath}
            className="mt-3 inline-flex items-center gap-2 font-mono text-xs font-bold underline decoration-[#00b943] decoration-2 underline-offset-4"
          >
            Open epic.li/@{result.handle} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      <div className="mt-5 border-2 border-[#1c1c16] bg-[#f7f3ea] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#087d32]">
              // Data refresh
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-[#53614e]">
              Pull the latest {providerName} data, refresh the public snapshot, and add new dated charges.
              Profile details are not changed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResync}
            disabled={pending || pendingPayload || pendingResync}
            className="flex min-h-11 shrink-0 items-center justify-center border-2 border-[#1c1c16] bg-white px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#1c1c16] disabled:cursor-not-allowed disabled:bg-[#d8d8d1] disabled:text-[#66665e] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            {pendingResync ? "Resyncing data…" : "Resync latest data"}
          </button>
        </div>

        {resyncResult?.kind === "success" && (
          <p role="status" className="mt-3 border-2 border-[#087d32] bg-[#e7f6e7] p-3 text-sm leading-6 text-[#0b5d27]">
            Data synced {new Date(resyncResult.resyncedAt).toISOString()}. Processed{" "}
            {(resyncResult.counts.chargeEvents ?? 0).toLocaleString("en-US")} charge events,{" "}
            {resyncResult.counts.snapshots ?? 0} snapshot rows, {resyncResult.counts.products ?? 0} products,
            and {resyncResult.counts.plans ?? 0} plans.
          </p>
        )}

        {resyncResult?.kind === "error" && (
          <p role="alert" className="mt-3 border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
            {resyncResult.message}
          </p>
        )}
      </div>

      <ShowcaseEditor handle={profileHandle} proof={verifiedProof} disabled={pending || pendingPayload || pendingResync} />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="submit"
          disabled={pending || pendingPayload || pendingResync}
          className="flex min-h-12 w-full items-center justify-center gap-3 border-2 border-[#1c1c16] bg-[#00e55b] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] disabled:cursor-not-allowed disabled:bg-[#d8d8d1] disabled:text-[#66665e] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 sm:text-xs"
        >
          {pending ? "Checking secret and saving…" : "Save profile changes"}
        </button>
        <button
          type="button"
          onClick={handleViewPayload}
          disabled={pending || pendingPayload || pendingResync}
          className="flex min-h-12 w-full items-center justify-center gap-3 border-2 border-[#1c1c16] bg-white px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] disabled:cursor-not-allowed disabled:bg-[#d8d8d1] disabled:text-[#66665e] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 sm:text-xs"
        >
          {pendingPayload ? "Decrypting payload…" : "View raw payload"}
        </button>
      </div>

      {payloadState?.kind === "loading" && (
        <p
          role="status"
          className="mt-4 border-2 border-[#1c1c16] bg-[#f7f3ea] p-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#53614e]"
        >
          Verifying the secret and decrypting the latest provider payload…
        </p>
      )}

      {payloadState?.kind === "error" && (
        <p role="alert" className="mt-4 border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
          {payloadState.message}
        </p>
      )}

      {payloadState?.kind === "success" && (
        <section
          aria-label="Raw provider payload"
          className="mt-4 border-2 border-[#1c1c16] bg-[#1c1c16] shadow-[6px_6px_0px_#1c1c16]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#3f4439] p-4">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#00e55b]">
                // Raw provider payload
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[#b9c4ae]">
                {payloadState.providerName}
                {payloadState.fetchedAt ? ` · fetched ${new Date(payloadState.fetchedAt).toISOString()}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="border-2 border-[#00e55b] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#00e55b] transition-colors hover:bg-[#00e55b] hover:text-[#1c1c16]"
            >
              {payloadCopied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <pre className="max-h-[36rem] overflow-auto whitespace-pre p-4 font-mono text-[11px] leading-5 text-[#e7f6e7]">
            {JSON.stringify(payloadState.payload, null, 2)}
          </pre>
          <p className="border-t-2 border-[#3f4439] px-4 py-3 text-[11px] leading-5 text-[#b9c4ae]">
            This is the latest stored provider response, decrypted only after your secret matched. It can contain
            customer data; do not share it.
          </p>
        </section>
      )}
    </form>
  )
}
