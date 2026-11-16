import { useState } from "react"

import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { DeleteSection } from "@/components/dialogs/delete-section"
import { FolderField } from "@/components/fields/channel/folder-field"
import { PrivateField } from "@/components/fields/channel/private-field"
import { ReplyModeField } from "@/components/fields/channel/reply-mode-field"
import { SleepField } from "@/components/fields/channel/sleep-field"
import { TopicField } from "@/components/fields/channel/topic-field"
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
import type { ChannelSettingsDraft } from "../../../../server/schemas.ts"

export function SettingsForm({
  conversation,
  onSaved,
  onDelete,
}: {
  conversation: Conversation
  onSaved: () => void
  onDelete: () => void
}) {
  const [topic, setTopic] = useState(conversation.topic ?? "")
  const [isPrivate, setPrivate] = useState(conversation.private)
  const [replyMode, setReplyMode] = useState(conversation.replyMode)
  const [cwd, setCwd] = useState(conversation.cwd ?? "")
  const [sleep, setSleep] = useState(
    conversation.sleepAfterMinutes === null
      ? ""
      : String(conversation.sleepAfterMinutes)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const changes: ChannelSettingsDraft = {}
    if (topic.trim() !== (conversation.topic ?? "")) changes.topic = topic
    if (isPrivate !== conversation.private) changes.private = isPrivate
    if (replyMode !== conversation.replyMode) changes.replyMode = replyMode
    if (cwd.trim() !== (conversation.cwd ?? "")) changes.cwd = cwd
    const sleepAfterMinutes = sleep.trim() === "" ? null : Number(sleep)
    if (sleepAfterMinutes !== conversation.sleepAfterMinutes) {
      changes.sleepAfterMinutes = sleepAfterMinutes
    }
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
        <SleepField value={sleep} onChange={setSleep} />
      </FieldGroup>
      <DeleteSection
        action="Delete channel"
        text={`Deletes the messages and files of #${conversation.name}. The agents stay.`}
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
