import { DeleteSection } from "@/components/dialogs/delete-section"
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
        <DialogHeader>
          <DialogTitle>Group chat settings</DialogTitle>
          <DialogDescription>{conversation.name}</DialogDescription>
        </DialogHeader>
        <DeleteSection
          action="Delete group chat"
          text="Deletes the messages and files of this group chat. The agents stay."
          onDelete={onDelete}
        />
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
