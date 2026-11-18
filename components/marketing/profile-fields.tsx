"use client"

import type { Dispatch, SetStateAction } from "react"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  PROFILE_SOCIAL_PLATFORMS,
  type ProfileFieldsValue,
} from "@/lib/profile-links"

type ProfileFieldsProps = {
  prefix: string
  values: ProfileFieldsValue
  onChange: Dispatch<SetStateAction<ProfileFieldsValue>>
  disabled?: boolean
}

const labelClassName = "font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
const inputClassName =
  "min-h-11 rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 text-sm focus-visible:border-[#00b943] focus-visible:ring-2 focus-visible:ring-[#00b943]/40"

export function ProfileFields({
  prefix,
  values,
  onChange,
  disabled = false,
}: ProfileFieldsProps) {
  return (
    <FieldGroup className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-handle`} className={labelClassName}>
          Public handle
        </FieldLabel>
        <div className="flex border-2 border-[#1c1c16] focus-within:ring-2 focus-within:ring-[#00b943]">
          <span className="border-r-2 border-[#1c1c16] bg-[#f2ede4] px-3 py-3 font-mono text-sm text-[#53614e]">
            @
          </span>
          <Input
            id={`${prefix}-handle`}
            name="handle"
            value={values.handle}
            onChange={(event) =>
              onChange((current) => ({ ...current, handle: event.target.value }))
            }
            autoComplete="off"
            maxLength={32}
            pattern="[A-Za-z0-9][A-Za-z0-9-]{0,30}[A-Za-z0-9]?"
            required
            disabled={disabled}
            className="h-auto min-h-11 flex-1 rounded-none border-0 bg-white px-3 py-3 font-mono text-sm focus-visible:ring-0"
            placeholder="yourname"
          />
        </div>
        <FieldDescription className="text-xs text-[#66705f]">
          Lowercase letters, numbers, and hyphens. Changing this updates your public URL.
        </FieldDescription>
      </Field>

      <Field data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-display-name`} className={labelClassName}>
          Display name
        </FieldLabel>
        <Input
          id={`${prefix}-display-name`}
          name="displayName"
          value={values.displayName}
          onChange={(event) =>
            onChange((current) => ({ ...current, displayName: event.target.value }))
          }
          autoComplete="name"
          maxLength={80}
          required
          disabled={disabled}
          className={inputClassName}
          placeholder="Your name or company"
        />
      </Field>

      <Field className="sm:col-span-2" data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-bio`} className={labelClassName}>
          Short bio <span className="font-normal normal-case text-[#66705f]">(optional)</span>
        </FieldLabel>
        <Textarea
          id={`${prefix}-bio`}
          name="bio"
          value={values.bio}
          onChange={(event) =>
            onChange((current) => ({ ...current, bio: event.target.value }))
          }
          maxLength={280}
          rows={3}
          disabled={disabled}
          className="min-h-20 resize-y rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 text-sm focus-visible:border-[#00b943] focus-visible:ring-2 focus-visible:ring-[#00b943]/40"
          placeholder="What are you building?"
        />
      </Field>

      <Field data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-contact-email`} className={labelClassName}>
          Private contact email <span className="font-normal normal-case text-[#66705f]">(optional)</span>
        </FieldLabel>
        <Input
          id={`${prefix}-contact-email`}
          name="contactEmail"
          type="email"
          value={values.contactEmail}
          onChange={(event) =>
            onChange((current) => ({ ...current, contactEmail: event.target.value }))
          }
          autoComplete="email"
          maxLength={254}
          disabled={disabled}
          className={inputClassName}
          placeholder="you@example.com"
        />
        <FieldDescription className="text-xs text-[#66705f]">
          Stored privately for your records. This address is never shown on your public page.
        </FieldDescription>
      </Field>

      <Field data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-website-url`} className={labelClassName}>
          Website <span className="font-normal normal-case text-[#66705f]">(optional)</span>
        </FieldLabel>
        <Input
          id={`${prefix}-website-url`}
          name="websiteUrl"
          type="url"
          value={values.websiteUrl}
          onChange={(event) =>
            onChange((current) => ({ ...current, websiteUrl: event.target.value }))
          }
          autoComplete="url"
          maxLength={2048}
          disabled={disabled}
          className={inputClassName}
          placeholder="https://example.com"
        />
      </Field>

      <Field data-disabled={disabled || undefined}>
        <FieldLabel htmlFor={`${prefix}-app-url`} className={labelClassName}>
          App / product link <span className="font-normal normal-case text-[#66705f]">(optional)</span>
        </FieldLabel>
        <Input
          id={`${prefix}-app-url`}
          name="appUrl"
          type="url"
          value={values.appUrl}
          onChange={(event) =>
            onChange((current) => ({ ...current, appUrl: event.target.value }))
          }
          maxLength={2048}
          disabled={disabled}
          className={inputClassName}
          placeholder="https://app.example.com"
        />
      </Field>

      <FieldSet className="sm:col-span-2" disabled={disabled}>
        <FieldLegend variant="label" className={labelClassName}>
          Social profiles <span className="font-normal normal-case text-[#66705f]">(optional)</span>
        </FieldLegend>
        <FieldDescription className="text-xs text-[#66705f]">
          Add direct HTTPS profile links. Only links on the selected platform are accepted.
        </FieldDescription>
        <FieldGroup className="mt-2 grid gap-3 sm:grid-cols-2">
          {PROFILE_SOCIAL_PLATFORMS.map((platform) => {
            const id = `${prefix}-social-${platform.key}`
            return (
              <Field key={platform.key} data-disabled={disabled || undefined}>
                <FieldLabel htmlFor={id} className={labelClassName}>
                  {platform.label}
                </FieldLabel>
                <Input
                  id={id}
                  name={`socialLinks.${platform.key}`}
                  type="url"
                  value={values.socialLinks[platform.key] ?? ""}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      socialLinks: {
                        ...current.socialLinks,
                        [platform.key]: event.target.value,
                      },
                    }))
                  }
                  maxLength={2048}
                  disabled={disabled}
                  className={inputClassName}
                  placeholder={platform.placeholder}
                />
              </Field>
            )
          })}
        </FieldGroup>
      </FieldSet>
    </FieldGroup>
  )
}
