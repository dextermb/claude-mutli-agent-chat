import { useState } from "react"

import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { DeleteSection } from "@/components/dialogs/delete-section"
import { RulesField } from "@/components/fields/channel/rules-field"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import type { Conversation } from "@/lib/agent-api"
import { refusalOf } from "@/lib/refusal"

export function GroupSettingsForm({
  conversation,
  onSaved,
  onDelete,
}: {
  conversation: Conversation
  onSaved: () => void
  onDelete: () => void
}) {
  const [rules, setRules] = useState(conversation.rules ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (rules.trim() === (conversation.rules ?? "")) {
      onSaved()
      return
    }
    setSaving(true)
    const refusal = await refusalOf(
      fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules }),
      })
    )
    setSaving(false)
    if (refusal) {
      setError(refusal)
      return
    }
    onSaved()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>Group chat settings</DialogTitle>
        <DialogDescription>{conversation.name}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <RulesField place="group chat" value={rules} onChange={setRules} />
      </FieldGroup>
      <DeleteSection
        action="Delete group chat"
        text="Deletes the messages and files of this group chat. The agents stay."
        onDelete={onDelete}
      />
      {error && (
        <RefusalAlert
          title="The server did not save the settings."
          refusal={error}
        />
      )}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={saving}>
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}
