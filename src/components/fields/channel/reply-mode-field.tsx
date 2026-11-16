import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Conversation } from "@/lib/agent-api"

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
