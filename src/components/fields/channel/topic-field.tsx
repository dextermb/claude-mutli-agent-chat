import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function TopicField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor="channel-topic">Topic</FieldLabel>
      <Input
        id="channel-topic"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
  )
}
