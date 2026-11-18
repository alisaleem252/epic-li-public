"use client"

import { useEffect, useState } from "react"
import type { VerifiedCredentialProof } from "@/lib/credential-proof"
import { PROFILE_SOCIAL_PLATFORMS, type ProfileSocialLinks, type ProfileSocialPlatform } from "@/lib/profile-links"

type CatalogItem = { kind: "product" | "plan"; id: string; name: string; detail: string | null; isPublic: boolean }
type AudienceRow = { platform: ProfileSocialPlatform; followers: number; source: "verified" | "self_reported" }

type ShowcaseResponse = {
  error?: string
  message?: string
  retryAfterSeconds?: number
  catalog?: CatalogItem[]
  audience?: AudienceRow[]
  socialLinks?: ProfileSocialLinks
  githubVerified?: boolean | null
  featureOnHomepage?: boolean
}

type Loaded = {
  catalog: CatalogItem[]
  hidden: Set<string>
  followers: Record<string, string>
  socialLinks: ProfileSocialLinks
  verifiedGithub: number | null
  feature: boolean
}

const itemKey = (item: Pick<CatalogItem, "kind" | "id">) => `${item.kind}:${item.id}`

function friendlyError(data: ShowcaseResponse | null) {
  if (data?.error === "key_mismatch") return "That secret does not match the credentials used to create this profile."
  if (data?.error === "rate_limited") {
    const seconds = data.retryAfterSeconds
    return typeof seconds === "number"
      ? `Too many attempts. Try again in about ${Math.max(1, Math.ceil(seconds / 60))} minutes.`
      : "Too many attempts. Wait before trying again."
  }
  if (data?.error === "invalid_input") return "Follower counts must be whole numbers."
  return data?.message ?? "Showcase settings could not be processed."
}

function toLoaded(data: ShowcaseResponse): Loaded {
  const catalog = data.catalog ?? []
  const followers: Record<string, string> = {}
  let verifiedGithub: number | null = null
  for (const row of data.audience ?? []) {
    if (row.platform === "github" && row.source === "verified") verifiedGithub = row.followers
    else followers[row.platform] = String(row.followers)
  }
  return {
    catalog,
    hidden: new Set(catalog.filter((item) => !item.isPublic).map(itemKey)),
    followers,
    socialLinks: data.socialLinks ?? {},
    verifiedGithub,
    feature: data.featureOnHomepage ?? false,
  }
}

/**
 * Owner-only controls: which products/plans appear on the public page, and follower counts.
 * Every request carries the same credential proof as the rest of the editor.
 * Rendered inside the edit form, so it must not contain a <form>.
 */
export function ShowcaseEditor({
  handle,
  proof,
  disabled,
  autoLoad,
  wantsFeature,
  onSaved,
}: {
  handle: string
  proof: VerifiedCredentialProof
  disabled?: boolean
  /** Load settings immediately (used by the post-create review step). */
  autoLoad?: boolean
  /** Pre-ticks the homepage checkbox with the consent given on the create form. */
  wantsFeature?: boolean
  onSaved?: () => void
}) {
  const [state, setState] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function call(action: "load" | "save", extra: Record<string, unknown> = {}) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(handle)}/showcase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action, ...proof, ...extra }),
      })
      const data = (await response.json().catch(() => null)) as ShowcaseResponse | null
      if (!response.ok || !data?.catalog) {
        setMessage({ kind: "error", text: friendlyError(data) })
        return null
      }
      setState(toLoaded(data))
      return data
    } catch {
      setMessage({ kind: "error", text: "The request could not reach epic.li. Please try again." })
      return null
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!autoLoad) return
    void call("load").then((data) => {
      if (data && wantsFeature) setState((current) => (current ? { ...current, feature: true } : current))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!state) return
    const hiddenProducts = state.catalog.filter((i) => i.kind === "product" && state.hidden.has(itemKey(i))).map((i) => i.id)
    const hiddenPlans = state.catalog.filter((i) => i.kind === "plan" && state.hidden.has(itemKey(i))).map((i) => i.id)

    const followers: Record<string, number | null> = {}
    for (const platform of PROFILE_SOCIAL_PLATFORMS) {
      if (platform.key === "github" || !state.socialLinks[platform.key]) continue
      const raw = (state.followers[platform.key] ?? "").replace(/[,\s]/g, "")
      if (raw === "") followers[platform.key] = null
      else if (/^\d{1,10}$/.test(raw)) followers[platform.key] = Number(raw)
      else {
        setMessage({ kind: "error", text: `${platform.label}: enter a whole number, or leave it blank.` })
        return
      }
    }

    const data = await call("save", { hidden: { products: hiddenProducts, plans: hiddenPlans }, followers, featureOnHomepage: state.feature })
    if (data) {
      const github = state.socialLinks.github
      onSaved?.()
      setMessage({
        kind: "ok",
        text:
          github && data.githubVerified === false
            ? "Saved. GitHub followers could not be read just now, so the previous verified count (if any) was kept."
            : "Saved. Your public page updates within a minute.",
      })
    }
  }

  function toggle(item: CatalogItem, show: boolean) {
    setState((current) => {
      if (!current) return current
      const hidden = new Set(current.hidden)
      if (show) hidden.delete(itemKey(item))
      else hidden.add(itemKey(item))
      return { ...current, hidden }
    })
  }

  function setGroup(kind: CatalogItem["kind"], show: boolean) {
    setState((current) => {
      if (!current) return current
      const hidden = new Set(current.hidden)
      for (const item of current.catalog) {
        if (item.kind !== kind) continue
        if (show) hidden.delete(itemKey(item))
        else hidden.add(itemKey(item))
      }
      return { ...current, hidden }
    })
  }

  const products = state?.catalog.filter((item) => item.kind === "product") ?? []
  const plans = state?.catalog.filter((item) => item.kind === "plan") ?? []
  const linkedPlatforms = PROFILE_SOCIAL_PLATFORMS.filter((platform) => state?.socialLinks[platform.key])

  return (
    <section aria-label="Public showcase" className="mt-5 border-2 border-[#1c1c16] bg-[#f7f3ea] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#087d32]">// Public showcase</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-[#53614e]">
            Choose which products and plans appear on your page, and add follower counts. Hiding an item never changes
            your revenue totals or charts.
          </p>
        </div>
        {!state ? (
          <button
            type="button"
            onClick={() => void call("load")}
            disabled={busy || disabled}
            className="flex min-h-11 shrink-0 items-center justify-center border-2 border-[#1c1c16] bg-white px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0px_#1c1c16] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Loading…" : "Load showcase settings"}
          </button>
        ) : null}
      </div>

      {state ? (
        <div className="mt-4 grid gap-5">
          {[
            { title: "Products", kind: "product" as const, items: products },
            { title: "Plans", kind: "plan" as const, items: plans },
          ].map((group) => (
            <fieldset key={group.title} className="min-w-0">
              <legend className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                {group.title} <span className="text-[#626257]">({group.items.filter((i) => !state.hidden.has(itemKey(i))).length} of {group.items.length} shown)</span>
              </legend>
              {group.items.length > 1 ? (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setGroup(group.kind, true)} disabled={busy || disabled} className="min-h-9 border-2 border-[#1c1c16] bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] disabled:opacity-60">
                    Select all
                  </button>
                  <button type="button" onClick={() => setGroup(group.kind, false)} disabled={busy || disabled} className="min-h-9 border-2 border-[#1c1c16] bg-white px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] disabled:opacity-60">
                    Unselect all
                  </button>
                </div>
              ) : null}
              {group.items.length === 0 ? (
                <p className="mt-2 text-sm text-[#626257]">None synced yet.</p>
              ) : (
                <ul className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto">
                  {group.items.map((item) => {
                    const id = `showcase-${itemKey(item)}`
                    return (
                      <li key={itemKey(item)}>
                        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-[#1c1c16]/25 bg-white px-3 py-2">
                          <input
                            id={id}
                            type="checkbox"
                            checked={!state.hidden.has(itemKey(item))}
                            onChange={(event) => toggle(item, event.target.checked)}
                            disabled={busy || disabled}
                            className="size-4 accent-[#087d32]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{item.name}</span>
                            {item.detail ? <span className="block font-mono text-[10px] uppercase text-[#626257]">{item.detail}</span> : null}
                          </span>
                          <span className="font-mono text-[9px] font-bold uppercase text-[#626257]">
                            {state.hidden.has(itemKey(item)) ? "Hidden" : "Shown"}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </fieldset>
          ))}

          <fieldset className="min-w-0">
            <legend className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">Followers</legend>
            {linkedPlatforms.length === 0 ? (
              <p className="mt-2 text-sm text-[#626257]">
                Add a social link in the profile fields above and save the profile first; follower counts attach to a linked account.
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {linkedPlatforms.map((platform) => {
                  const id = `showcase-followers-${platform.key}`
                  const isGithub = platform.key === "github"
                  return (
                    <div key={platform.key}>
                      <label htmlFor={id} className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
                        {platform.label}{" "}
                        <span className={isGithub ? "text-[#087d32]" : "text-[#626257]"}>
                          {isGithub ? "verified from GitHub" : "self-reported"}
                        </span>
                      </label>
                      <input
                        id={id}
                        inputMode="numeric"
                        value={isGithub ? (state.verifiedGithub !== null ? state.verifiedGithub.toLocaleString("en-US") : "") : (state.followers[platform.key] ?? "")}
                        readOnly={isGithub}
                        placeholder={isGithub ? "Fetched when you save" : "Followers"}
                        onChange={(event) =>
                          setState((current) =>
                            current ? { ...current, followers: { ...current.followers, [platform.key]: event.target.value } } : current,
                          )
                        }
                        disabled={busy || disabled}
                        className="mt-1 min-h-11 w-full border-2 border-[#1c1c16] bg-white px-3 font-mono text-sm read-only:bg-[#f2ede4]"
                      />
                    </div>
                  )
                })}
              </div>
            )}
            <p className="mt-2 text-xs leading-5 text-[#626257]">
              Only GitHub can be checked automatically (public API). Other counts are shown as self-reported on your page.
            </p>
          </fieldset>

          <label htmlFor="showcase-feature" className="flex cursor-pointer items-start gap-3 border-2 border-[#1c1c16] bg-white p-3">
            <input
              id="showcase-feature"
              type="checkbox"
              checked={state.feature}
              onChange={(event) => setState((current) => (current ? { ...current, feature: event.target.checked } : current))}
              disabled={busy || disabled}
              className="mt-0.5 size-4 accent-[#087d32]"
            />
            <span className="text-sm leading-5">
              <span className="block font-semibold">Feature my profile on the epic.li homepage</span>
              <span className="block text-xs text-[#626257]">Applies when you save, using the products and plans selected above. You can turn it off any time.</span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || disabled}
            className="flex min-h-11 items-center justify-center border-2 border-[#1c1c16] bg-[#00e55b] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0px_#1c1c16] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save showcase"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            "mt-3 border-2 p-3 text-sm " +
            (message.kind === "error" ? "border-[#8d2f1f] bg-[#fff1ed] text-[#762819]" : "border-[#087d32] bg-[#e7f6e7] text-[#0b5d27]")
          }
        >
          {message.text}
        </p>
      ) : null}
    </section>
  )
}
