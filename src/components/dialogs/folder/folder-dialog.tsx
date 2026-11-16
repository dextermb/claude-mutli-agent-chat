import { FolderPicker } from "@/components/dialogs/folder/folder-picker"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export function FolderDialog({
  open,
  start,
  onOpenChange,
  onPick,
}: {
  open: boolean
  start: string
  onOpenChange: (open: boolean) => void
  onPick: (path: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {open && <FolderPicker start={start} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  )
}
