import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export function RulesField({
  place,
  value,
  errors = [],
  onChange,
  onBlur,
}: {
  place: "channel" | "group chat"
  value: string
  errors?: { message?: string }[]
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  const invalid = errors.length > 0
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="conversation-rules">Rules</FieldLabel>
      <Textarea
        id="conversation-rules"
        rows={4}
        className="max-h-60"
        value={value}
        aria-invalid={invalid}
        aria-describedby="conversation-rules-description"
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
      />
      <FieldDescription id="conversation-rules-description">
        Each agent in this {place} follows these rules, also when they disagree
        with its own system prompt. A change reaches an agent with its next
        message.
      </FieldDescription>
      <FieldError errors={errors} />
    </Field>
  )
}
