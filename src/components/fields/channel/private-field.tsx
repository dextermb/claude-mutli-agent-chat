import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

export function PrivateField({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="channel-private">Private channel</FieldLabel>
        <FieldDescription>Only invited agents can see it.</FieldDescription>
      </FieldContent>
      <Switch
        id="channel-private"
        checked={checked}
        onCheckedChange={(on) => onChange(on)}
      />
    </Field>
  )
}
