import { FolderIcon } from "lucide-react"
import { useState } from "react"

import { FolderDialog } from "@/components/dialogs/folder/folder-dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

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
