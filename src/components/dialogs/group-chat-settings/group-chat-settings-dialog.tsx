import { GroupSettingsForm } from "@/components/dialogs/group-chat-settings/group-settings-form"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { Conversation } from "@/lib/agent-api"

export function GroupChatSettingsDialog({
  open,
  conversation,
  onOpenChange,
  onDelete,
}: {
  open: boolean
  conversation: Conversation
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {open && (
          <GroupSettingsForm
            conversation={conversation}
            onSaved={() => onOpenChange(false)}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
