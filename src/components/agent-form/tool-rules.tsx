import { XIcon } from "lucide-react"
import { useState, type KeyboardEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ToolRules({
  id,
  label,
  inputLabel,
  placeholder,
  rules,
  blocked = false,
  onChange,
}: {
  id: string
  label: string
  inputLabel: string
  placeholder: string
  rules: string[]
  blocked?: boolean
  onChange: (rules: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    const rule = draft.trim()
    if (rule !== "" && !rules.includes(rule)) onChange([...rules, rule])
    setDraft("")
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
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
                  <XIcon />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        aria-label={inputLabel}
        className="font-mono"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
