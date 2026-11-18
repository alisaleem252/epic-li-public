"use client"

import type { ChangeEvent } from "react"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ProviderCredentialField } from "@/lib/providers/registry"
import { cn } from "@/lib/utils"

type ProviderCredentialFieldsProps = {
  prefix: string
  fields: readonly ProviderCredentialField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  disabled?: boolean
  secretFieldsOnly?: boolean
}

export function ProviderCredentialFields({
  prefix,
  fields,
  values,
  onChange,
  disabled = false,
  secretFieldsOnly = false,
}: ProviderCredentialFieldsProps) {
  const visibleFields = secretFieldsOnly ? fields.filter((field) => field.secret) : fields

  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      {visibleFields.map((field) => {
        const id = `${prefix}-${field.key}`
        const descriptionId = `${id}-description`
        const sharedProps = {
          id,
          name: field.key,
          value: values[field.key] ?? "",
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange(field.key, event.target.value),
          autoComplete: "off" as const,
          spellCheck: false,
          maxLength: field.maxLength,
          required: !field.optional,
          disabled,
          "aria-describedby": descriptionId,
        }

        return (
          <Field
            key={field.key}
            data-disabled={disabled || undefined}
            className={cn(field.inputType === "textarea" && "sm:col-span-2")}
          >
            <FieldLabel htmlFor={id} className="font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
              {field.label}
            </FieldLabel>
            {field.inputType === "textarea" ? (
              <Textarea
                {...sharedProps}
                rows={5}
                className="min-h-28 rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 font-mono text-xs leading-5 focus-visible:ring-2 focus-visible:ring-[#00b943]"
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                {...sharedProps}
                type={field.inputType === "password" ? "password" : "text"}
                className="min-h-11 rounded-none border-2 border-[#1c1c16] bg-white px-3 py-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-[#00b943]"
                placeholder={field.placeholder}
              />
            )}
            <FieldDescription id={descriptionId} className="text-xs leading-5 text-[#66705f]">
              {field.helperText}
            </FieldDescription>
          </Field>
        )
      })}
    </FieldGroup>
  )
}
