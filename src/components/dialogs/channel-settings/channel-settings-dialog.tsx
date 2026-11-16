import { SettingsForm } from "@/components/dialogs/channel-settings/settings-form"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { Conversation } from "@/lib/agent-api"

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
