import { XIcon } from "lucide-react"
import { useState, type KeyboardEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

export function ToolRules({
  id,
  label,
  inputLabel,
  placeholder,
  rules,
  empty,
  blocked = false,
  errors = [],
  onChange,
}: {
  id: string
  label: string
  inputLabel: string
  placeholder: string
  rules: string[]
  empty?: string
  blocked?: boolean
  errors?: { message?: string }[]
  onChange: (rules: string[]) => void
}) {
  const invalid = errors.length > 0
  const [draft, setDraft] = useState("")

  function add() {
    const rule = draft.trim()
    if (rule !== "" && !rules.includes(rule)) onChange([...rules, rule])
    setDraft("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    add()
  }

  return (
    <Field aria-labelledby={`${id}-label`} data-invalid={invalid}>
      <FieldLabel id={`${id}-label`} htmlFor={id}>
        {label}
      </FieldLabel>
      {rules.length === 0 && empty && (
        <p className="m-0 text-[13px] text-foreground-faint">{empty}</p>
      )}
      {rules.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {rules.map((rule) => (
            <li key={rule}>
              <Badge
                variant={blocked ? "destructive" : "secondary"}
                className="font-mono"
              >
                {rule}
                <button
                  type="button"
                  aria-label={`Remove ${rule}`}
                  onClick={() =>
                    onChange(rules.filter((item) => item !== rule))
                  }
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <InputGroup>
        <InputGroupInput
          id={id}
          aria-label={inputLabel}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="font-mono"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="xs" onClick={add}>
            Add
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldError id={`${id}-error`} errors={errors} />
    </Field>
  )
}
