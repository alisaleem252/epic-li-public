"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { EditProfileForm } from "@/components/marketing/edit-profile-form"
import { ProviderCredentialFields } from "@/components/marketing/provider-credential-fields"
import type { VerifiedCredentialProof } from "@/lib/credential-proof"
import type { ProfileFieldsValue } from "@/lib/profile-links"
import { getProviderDefinition, type RevenueSourceId } from "@/lib/providers/registry"

type AccessResponse = {
  error?: string
  message?: string
  retryAfterSeconds?: number
  providerId?: string
  providerName?: string
  profile?: {
    handle: string
    displayName: string
    bio: string
    contactEmail: string
    websiteUrl: string
    appUrl: string
    socialLinks: ProfileFieldsValue["socialLinks"]
  }
}

type UnlockedEditor = {
  initialValues: ProfileFieldsValue
  proof: VerifiedCredentialProof
}

type EditProfileGateProps = {
  handle: string
  providerId: RevenueSourceId
  providerName: string
}

function accessErrorMessage(data: AccessResponse | null) {
  if (data?.error === "key_mismatch") {
    return "That secret does not match the credentials used to create this profile."
  }
  if (data?.error === "invalid_key_format") {
    return "Enter the same live restricted key used to create this profile."
  }
  if (data?.error === "invalid_provider_credentials") {
    return "Enter the same provider secret originally connected to this profile."
  }
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many attempts. Wait before trying again."
  }
  if (data?.error === "rate_limit_unavailable" || data?.error === "encryption_unavailable") {
    return "Secure editor access is temporarily unavailable. Please try again later."
  }
  return data?.message ?? "The editor could not be unlocked. Check the secret and try again."
}

export function EditProfileGate({ handle, providerId, providerName }: EditProfileGateProps) {
  const [stripeRestrictedKey, setStripeRestrictedKey] = useState("")
  const [providerCredentials, setProviderCredentials] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<UnlockedEditor | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (unlocked) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.focus()

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [unlocked])

  function currentProof(): VerifiedCredentialProof {
    if (providerId === "stripe") return { stripeRestrictedKey }
    return {
      providerId,
      credentials: Object.fromEntries(
        getProviderDefinition(providerId).fields
          .filter((field) => field.secret)
          .map((field) => [field.key, providerCredentials[field.key] ?? ""]),
      ),
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const proof = currentProof()
    const missingSecret = "stripeRestrictedKey" in proof
      ? proof.stripeRestrictedKey.trim().length === 0
      : Object.values(proof.credentials).some((value) => value.trim().length === 0)
    if (missingSecret) {
      setError(`Enter the same ${providerName} secret to unlock the editor.`)
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(handle)}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(proof),
      })
      const data = (await response.json().catch(() => null)) as AccessResponse | null

      if (!response.ok || !data?.profile || !data.providerId) {
        setError(accessErrorMessage(data))
        return
      }

      setUnlocked({
        initialValues: {
          handle: data.profile.handle,
          displayName: data.profile.displayName,
          bio: data.profile.bio,
          contactEmail: data.profile.contactEmail,
          websiteUrl: data.profile.websiteUrl,
          appUrl: data.profile.appUrl,
          socialLinks: { ...data.profile.socialLinks },
        },
        proof,
      })
    } catch {
      setError("The request could not reach epic.li. Please try again.")
    } finally {
      setPending(false)
    }
  }

  if (unlocked) {
    return (
      <EditProfileForm
        initialValues={unlocked.initialValues}
        providerId={providerId}
        verifiedProof={unlocked.proof}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1c1c16]/80 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-6 sm:items-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-unlock-title"
          aria-describedby="editor-unlock-description"
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
          className="w-full max-w-lg border-2 border-[#1c1c16] bg-white p-5 shadow-[8px_8px_0px_#1c1c16] outline-none sm:p-7"
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-[#1c1c16] pb-4">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#087d32]">
                // Editor locked
              </p>
              <h2 id="editor-unlock-title" className="mt-1 text-2xl font-black uppercase tracking-[-0.06em]">
                Verify ownership
              </h2>
            </div>
            <span className="shrink-0 border-2 border-[#1c1c16] bg-[#ffddaf] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em]">
              @{handle}
            </span>
          </div>

          <p id="editor-unlock-description" className="mt-4 text-sm leading-6 text-[#53614e]">
            Enter the same {providerName} secret originally connected to this profile. The server checks it
            before the editor or any private profile field is shown.
          </p>

          <form onSubmit={handleUnlock} className="mt-5" aria-busy={pending}>
            {providerId === "stripe" ? (
              <FieldGroup>
                <Field data-disabled={pending || undefined}>
                  <FieldLabel
                    htmlFor="unlock-stripe-key"
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
                  >
                    Live restricted key
                  </FieldLabel>
                  <Input
                    id="unlock-stripe-key"
                    name="stripeRestrictedKey"
                    type="password"
                    value={stripeRestrictedKey}
                    onChange={(event) => setStripeRestrictedKey(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={255}
                    required
                    disabled={pending}
                    autoFocus
                    className="min-h-11 rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-[#00b943]"
                    placeholder="rk_live_…"
                  />
                  <FieldDescription className="text-xs leading-5 text-[#66705f]">
                    Use the same key that created this profile. It is sent over HTTPS and is never stored in
                    the page URL.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            ) : (
              <div className="border-2 border-[#1c1c16] bg-[#f7f3ea] p-4">
                <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                  Same {providerName} secret
                </p>
                <ProviderCredentialFields
                  prefix="unlock-provider"
                  fields={getProviderDefinition(providerId).fields}
                  values={providerCredentials}
                  onChange={(key, value) =>
                    setProviderCredentials((current) => ({ ...current, [key]: value }))
                  }
                  disabled={pending}
                  secretFieldsOnly
                />
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 border-2 border-[#1c1c16] bg-[#00e55b] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] disabled:cursor-not-allowed disabled:bg-[#d8d8d1] disabled:text-[#66665e] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 sm:text-xs"
            >
              {pending ? "Verifying secret…" : "Unlock editor"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#1c1c16] pt-4">
            <Link
              href={`/@${handle}`}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#53614e] underline decoration-[#00b943] decoration-2 underline-offset-4 hover:text-[#1c1c16]"
            >
              Back to @{handle}
            </Link>
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#66705f]">
              Secret checked server-side
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
