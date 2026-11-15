import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import type { Conversation } from "@/lib/agent-api"

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

export function ReplyModeField({
  value,
  onChange,
}: {
  value: Conversation["replyMode"]
  onChange: (value: Conversation["replyMode"]) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">When agents reply</FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(next) =>
          onChange(next === "every" ? "every" : "mention")
        }
      >
        <Field orientation="horizontal">
          <RadioGroupItem value="mention" id="reply-mention" />
          <FieldLabel htmlFor="reply-mention">Only when @mentioned</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <RadioGroupItem value="every" id="reply-every" />
          <FieldLabel htmlFor="reply-every">
            Every message (each agent spends tokens on each message)
          </FieldLabel>
        </Field>
      </RadioGroup>
    </FieldSet>
  )
}
