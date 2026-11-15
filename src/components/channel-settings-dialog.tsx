import { useState } from "react"

import {
  FolderField,
  PrivateField,
  ReplyModeField,
  TopicField,
} from "@/components/channel-fields"
import { RefusalAlert } from "@/components/conversation/refusal-alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import type { Conversation } from "@/lib/agent-api"
import { refusalOf } from "@/lib/refusal"
import type { ChannelSettingsDraft } from "../../server/schemas.ts"

export function ChannelSettingsDialog({
  open,
  conversation,
  onOpenChange,
}: {
  open: boolean
  conversation: Conversation
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {open && (
          <SettingsForm
            conversation={conversation}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({
  conversation,
  onSaved,
}: {
  conversation: Conversation
  onSaved: () => void
}) {
  const [topic, setTopic] = useState(conversation.topic ?? "")
  const [isPrivate, setPrivate] = useState(conversation.private)
  const [replyMode, setReplyMode] = useState(conversation.replyMode)
  const [cwd, setCwd] = useState(conversation.cwd ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const changes: ChannelSettingsDraft = {}
    if (topic.trim() !== (conversation.topic ?? "")) changes.topic = topic
    if (isPrivate !== conversation.private) changes.private = isPrivate
    if (replyMode !== conversation.replyMode) changes.replyMode = replyMode
    if (cwd.trim() !== (conversation.cwd ?? "")) changes.cwd = cwd
    if (Object.keys(changes).length === 0) {
      onSaved()
      return
    }
    setSaving(true)
    const refusal = await refusalOf(
      fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
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
        <DialogTitle>Channel settings</DialogTitle>
        <DialogDescription>#{conversation.name}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <TopicField value={topic} onChange={setTopic} />
        <PrivateField checked={isPrivate} onChange={setPrivate} />
        <FolderField value={cwd} onChange={setCwd} />
        <ReplyModeField value={replyMode} onChange={setReplyMode} />
      </FieldGroup>
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
