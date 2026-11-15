import { FolderIcon } from "lucide-react"
import { useState } from "react"

import { FolderDialog } from "@/components/agent-form/folder-dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
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

export function FolderField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [browsing, setBrowsing] = useState(false)
  return (
    <Field>
      <FieldLabel htmlFor="channel-cwd">Working directory</FieldLabel>
      <InputGroup>
        <InputGroupAddon>
          <FolderIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="channel-cwd"
          className="font-mono"
          placeholder="~/code/web-app"
          value={value}
          aria-describedby="channel-cwd-description"
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="xs" onClick={() => setBrowsing(true)}>
            Browse
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id="channel-cwd-description">
        Each agent in this channel works in this folder. Empty: each agent works
        in its own folder.
      </FieldDescription>
      <FolderDialog
        open={browsing}
        start={value}
        onOpenChange={setBrowsing}
        onPick={(path) => {
          onChange(path)
          setBrowsing(false)
        }}
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
