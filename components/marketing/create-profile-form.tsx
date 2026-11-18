"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ShowcaseEditor } from "@/components/marketing/showcase-editor"
import type { VerifiedCredentialProof } from "@/lib/credential-proof"
import type { RevenueProviderId } from "@/lib/providers/registry"
import { KeySetupBox } from "@/components/marketing/key-setup-box"
import { ProviderPicker } from "@/components/marketing/provider-picker"
import { ProfileFields } from "@/components/marketing/profile-fields"
import { ProviderCredentialFields } from "@/components/marketing/provider-credential-fields"
import {
  getProviderDefinition,
  type RevenueSourceId,
} from "@/lib/providers/registry"
import { EMPTY_PROFILE_FIELDS, type ProfileFieldsValue } from "@/lib/profile-links"
import { REQUIRED_STRIPE_PERMISSIONS } from "@/lib/stripe-permissions"

type ApiResponse = {
  error?: string
  message?: string
  missingPermissions?: string[]
  retryAfterSeconds?: number
  profilePath?: string
  handle?: string
}

type FormResult =
  | { kind: "error"; message: string }
  | { kind: "success"; profilePath: string; handle: string; proof: VerifiedCredentialProof }
  | null

function errorMessage(data: ApiResponse | null) {
  if (data?.error === "handle_taken") return "That handle is already in use. Choose another one."
  if (data?.error === "invalid_key") {
    return "Stripe could not authenticate this key. Confirm that it is an active live restricted key beginning with rk_live_."
  }
  if (data?.error === "missing_permissions") {
    const permissionLabels = Object.fromEntries(
      REQUIRED_STRIPE_PERMISSIONS.map((permission) => [permission.key, permission.label]),
    ) as Record<string, string>
    const missing = data.missingPermissions
      ?.map((permission) => permissionLabels[permission] ?? permission)
      .join(", ")
    return missing
      ? `Stripe denied read access to ${missing}. Use the updated preset and review those permissions in Stripe Dashboard.`
      : "Stripe denied one or more required read probes. Review the key permissions in Stripe Dashboard."
  }
  if (data?.error === "scope_review_required") {
    return "Confirm each required read permission and that all other permissions are set to None."
  }
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many attempts. Wait before trying again."
  }
  if (data?.error === "sync_limit_exceeded") {
    return "This provider exceeds the safe first-sync limit. No profile was created; reduce the source scope and retry."
  }
  if (data?.error === "stripe_unavailable" || data?.error === "sync_failed") {
    return "Stripe could not complete the read-only check. No profile was created. Please try again later."
  }
  if (data?.error === "provider_auth_failed" || data?.error === "provider_request_invalid" || data?.error === "invalid_provider_credentials") {
    return "The provider rejected the credentials or a required read permission is missing. Follow the setup steps and try again."
  }
  if (data?.error === "provider_unavailable") {
    return "The provider could not complete the read-only sync. No profile was created; please try again later."
  }
  if (data?.error === "rate_limit_unavailable" || data?.error === "encryption_unavailable") {
    return "Secure profile creation is temporarily unavailable. Please try again later."
  }
  return data?.message ?? "Profile creation failed. No profile was created; please review the form and try again."
}

export function CreateProfileForm({ initialHandle = "", inModal = false }: { initialHandle?: string; inModal?: boolean }) {
  const [profileFields, setProfileFields] = useState<ProfileFieldsValue>(() => ({
    ...EMPTY_PROFILE_FIELDS,
    handle: initialHandle,
    socialLinks: {},
  }))
  const [sourceId, setSourceId] = useState<RevenueSourceId>("stripe")
  const [providerCredentials, setProviderCredentials] = useState<Record<string, string>>({})
  const [stripeRestrictedKey, setStripeRestrictedKey] = useState("")
  const [reviewedPermissions, setReviewedPermissions] = useState<Record<string, boolean>>({})
  const [noAdditionalPermissions, setNoAdditionalPermissions] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [wantsFeature, setWantsFeature] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<FormResult>(null)

  const reviewedKeys = REQUIRED_STRIPE_PERMISSIONS.filter(
    (permission) => reviewedPermissions[permission.key],
  ).map((permission) => permission.key)
  const allPermissionsReviewed = reviewedKeys.length === REQUIRED_STRIPE_PERMISSIONS.length
  const selectedProvider = sourceId === "stripe" ? null : getProviderDefinition(sourceId)

  function changeSource(nextSourceId: RevenueSourceId) {
    setSourceId(nextSourceId)
    setStripeRestrictedKey("")
    setProviderCredentials({})
    setReviewedPermissions({})
    setNoAdditionalPermissions(false)
    setResult(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setResult(null)
    const submittedKey = stripeRestrictedKey
    const submittedCredentials = { ...providerCredentials }
    setStripeRestrictedKey("")
    setProviderCredentials({})

    try {
      const isStripe = sourceId === "stripe"
      const response = await fetch(isStripe ? "/api/profiles" : "/api/provider-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(isStripe
          ? {
              ...profileFields,
              stripeRestrictedKey: submittedKey,
              reviewedPermissionKeys: reviewedKeys,
              noAdditionalPermissionsConfirmed: noAdditionalPermissions,
            }
          : {
              ...profileFields,
              providerId: sourceId,
              credentials: submittedCredentials,
            }),
      })
      const data = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !data?.profilePath || !data.handle) {
        setResult({ kind: "error", message: errorMessage(data) })
        return
      }

      setResult({
        kind: "success",
        profilePath: data.profilePath,
        handle: data.handle,
        proof: isStripe
          ? { stripeRestrictedKey: submittedKey }
          : { providerId: sourceId as RevenueProviderId, credentials: submittedCredentials },
      })
    } catch {
      setResult({
        kind: "error",
        message: "The request could not reach epic.li. Credentials were cleared from this form; please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-2 border-[#1c1c16] bg-white p-5 shadow-[6px_6px_0px_#1c1c16] sm:p-7"
      aria-busy={pending}
    >
      <div className={`flex items-start justify-between gap-4 border-b-2 border-[#1c1c16] pb-4${inModal ? " pr-12" : ""}`}>
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#087d32]">
            // Profile setup
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.06em]">Your public page</h2>
        </div>
        <span className="border-2 border-[#1c1c16] bg-[#00e55b] px-2 py-1 font-mono text-[9px] font-bold uppercase">
          No signup
        </span>
      </div>

      <div className="mt-5">
        <ProviderPicker value={sourceId} onChange={changeSource} disabled={pending} />
      </div>

      <div className="mt-4">
        <KeySetupBox sourceId={sourceId} />
      </div>

      {selectedProvider ? (
        <div className="mt-4">
          <ProviderCredentialFields
            prefix={`provider-${selectedProvider.id}`}
            fields={selectedProvider.fields}
            values={providerCredentials}
            onChange={(key, value) => setProviderCredentials((current) => ({ ...current, [key]: value }))}
            disabled={pending}
          />
        </div>
      ) : null}

      {sourceId === "stripe" && (
      <div className="mt-5">
        <label htmlFor="stripe-restricted-key" className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
          3 · Paste your live restricted API key
        </label>
        <Input
          id="stripe-restricted-key"
          name="stripeRestrictedKey"
          type="password"
          value={stripeRestrictedKey}
          onChange={(event) => setStripeRestrictedKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={255}
          required
          disabled={pending}
          className="mt-2 min-h-11 rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-[#00b943]"
          placeholder="rk_live_…"
          aria-describedby="stripe-key-hint"
        />
        <p id="stripe-key-hint" className="mt-2 text-xs leading-5 text-[#66705f]">
          Only an rk_live_ restricted key is accepted. Never paste an sk_live_ secret key. The key is sent over HTTPS, encrypted before it is saved, and cleared from this form when submitted.
        </p>
      </div>
      )}

      <div className="mt-6 border-t-2 border-[#1c1c16]/15 pt-2">
        <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">4 · About you</p>
      <ProfileFields
        prefix="create-profile"
        values={profileFields}
        onChange={setProfileFields}
        disabled={pending}
      />
      </div>

      {sourceId === "stripe" && (
      <section className="mt-6 border-2 border-[#1c1c16] bg-[#f7f3ea] p-4 sm:p-5" aria-labelledby="dashboard-review-title">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#087d32]">// Required manual check</p>
        <h3 id="dashboard-review-title" className="mt-1 text-lg font-black uppercase tracking-[-0.04em]">
          Review the key in Stripe Dashboard
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#53614e]">
          Stripe does not return a restricted key&apos;s complete grant list through its API. The probes below check endpoint access only; they cannot detect extra permissions.
        </p>

        <FieldSet className="mt-4">
          <FieldLegend variant="label" className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
            Confirm each listed permission is set to Read
          </FieldLegend>
          <FieldGroup className="mt-2 grid gap-2 sm:grid-cols-2">
            {REQUIRED_STRIPE_PERMISSIONS.map((permission) => {
              const id = `permission-${permission.key}`
              return (
                <Field
                  key={permission.key}
                  orientation="horizontal"
                  className="min-h-12 cursor-pointer items-center border-2 border-[#1c1c16]/20 bg-white px-3 py-2.5"
                >
                  <Checkbox
                    id={id}
                    checked={Boolean(reviewedPermissions[permission.key])}
                    onCheckedChange={(checked) =>
                      setReviewedPermissions((current) => ({
                        ...current,
                        [permission.key]: checked === true,
                      }))
                    }
                    disabled={pending}
                    className="border-[#1c1c16]/50 data-checked:border-[#087d32] data-checked:bg-[#087d32]"
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={id} className="font-mono text-[10px] font-bold">
                      {permission.key}
                    </FieldLabel>
                    <FieldDescription className="text-xs text-[#66705f]">
                      {permission.label} · Read
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )
            })}
          </FieldGroup>
        </FieldSet>

        <FieldGroup className="mt-3">
          <Field
            orientation="horizontal"
            className="cursor-pointer items-start border-2 border-[#1c1c16]/20 bg-white p-3"
            data-disabled={pending || undefined}
          >
            <Checkbox
              id="no-additional-permissions"
              checked={noAdditionalPermissions}
              onCheckedChange={(checked) => setNoAdditionalPermissions(checked === true)}
              disabled={pending}
              className="mt-0.5 border-[#1c1c16]/50 data-checked:border-[#087d32] data-checked:bg-[#087d32]"
            />
            <FieldContent>
              <FieldLabel htmlFor="no-additional-permissions" className="text-xs leading-5 text-[#3c4638]">
                I checked the full key in Stripe Dashboard: every other permission is set to None.
              </FieldLabel>
            </FieldContent>
          </Field>
        </FieldGroup>
      </section>
      )}

      {result?.kind === "error" && (
        <p role="alert" className="mt-4 border-2 border-[#8d2f1f] bg-[#fff1ed] p-3 text-sm text-[#762819]">
          {result.message}
        </p>
      )}

      {result?.kind === "success" && (
        <div role="status" className="mt-4 border-2 border-[#1c1c16] bg-[#e7f6e7] p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#087d32]">Profile published</p>
          <p className="mt-1 text-sm">Your public page is ready.</p>
          <Link
            href={result.profilePath}
            className="mt-3 inline-flex items-center gap-2 font-mono text-xs font-bold underline decoration-[#00b943] decoration-2 underline-offset-4"
          >
            epic.li/@{result.handle} <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      {result?.kind === "success" && (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#087d32]">
            Next · review what is public{wantsFeature ? " before you are featured" : ""}
          </p>
          <ShowcaseEditor
            handle={result.handle}
            proof={result.proof}
            autoLoad
            wantsFeature={wantsFeature}
            onSaved={() => setReviewed(true)}
          />
          {wantsFeature && !reviewed ? (
            <p className="mt-2 text-xs leading-5 text-[#66705f]">
              You asked to be featured. It only takes effect after you save this step.
            </p>
          ) : null}
        </div>
      )}

      {result?.kind !== "success" && (
        <div className="mt-5 grid gap-3">
          <label htmlFor="feature-consent" className="flex cursor-pointer items-start gap-3 text-sm leading-5">
            <input id="feature-consent" type="checkbox" checked={wantsFeature} onChange={(e) => setWantsFeature(e.target.checked)} disabled={pending} className="mt-0.5 size-4 accent-[#087d32]" />
            <span>
              Feature my profile on the epic.li homepage. <span className="text-[#626257]">Optional. You will choose which products show before it goes live.</span>
            </span>
          </label>
          <label htmlFor="terms-consent" className="flex cursor-pointer items-start gap-3 text-sm leading-5">
            <input id="terms-consent" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={pending} required className="mt-0.5 size-4 accent-[#087d32]" />
            <span>
              I agree to the <Link href="/terms" target="_blank" className="font-semibold underline">Terms</Link>,{" "}
              <Link href="/privacy" target="_blank" className="font-semibold underline">Privacy Policy</Link> and{" "}
              <Link href="/cookies" target="_blank" className="font-semibold underline">Cookie Policy</Link>.
            </span>
          </label>
        </div>
      )}

      {result?.kind !== "success" && (
      <button
        type="submit"
        disabled={pending || !agreed || (sourceId === "stripe" && (!allPermissionsReviewed || !noAdditionalPermissions))}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 border-2 border-[#1c1c16] bg-[#00e55b] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[4px_4px_0px_#1c1c16] transition-transform hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_#1c1c16] disabled:cursor-not-allowed disabled:bg-[#d8d8d1] disabled:text-[#66665e] disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 sm:text-xs"
      >
        {pending
          ? "Checking provider and building profile…"
          : sourceId === "stripe"
            ? "Check permissions and publish"
            : "Verify provider and publish"}
        {!pending && <span aria-hidden="true">→</span>}
      </button>
      )}
      <p className="mt-3 text-center text-[11px] leading-5 text-[#66705f]">
        Only aggregate metrics and public catalog labels are saved. Customer records and raw provider responses are never stored or shown.
      </p>
    </form>
  )
}
