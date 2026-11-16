import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SleepField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor="channel-sleep">Sleep after (minutes)</FieldLabel>
      <Input
        id="channel-sleep"
        type="number"
        min={0}
        max={55}
        step={1}
        className="w-36 font-mono"
        value={value}
        aria-describedby="channel-sleep-description"
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <FieldDescription id="channel-sleep-description">
        After this idle time, an agent of this channel saves its memory and its
        process stops. Empty: the time of each agent. 0: never.
      </FieldDescription>
    </Field>
  )
}
