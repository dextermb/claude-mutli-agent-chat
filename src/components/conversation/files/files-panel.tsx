import { XIcon } from "lucide-react"

import { SharedFilesList } from "@/components/conversation/files/shared-files-list"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  AgentWithState,
  SharedFileView,
  TimelineEntry,
} from "@/lib/agent-api"

export function FilesPanel({
  asSheet,
  open,
  onClose,
  ...list
}: {
  asSheet: boolean
  open: boolean
  onClose: () => void
  files: SharedFileView[]
  entries: TimelineEntry[]
  agents: AgentWithState[]
  onRemove: (file: SharedFileView) => void
}) {
  const count = list.files.filter((file) => file.removedAt === null).length
  const summary = `${count} ${count === 1 ? "file" : "files"}`
  if (asSheet) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="right"
          className="w-80 max-w-[85vw] gap-0 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Shared files</SheetTitle>
            <SheetDescription>{summary}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-3 pb-4">
            <SharedFilesList {...list} />
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  if (!open) return null
  return (
    <aside
      aria-label="Shared files"
      className="flex w-[360px] flex-none flex-col gap-3 overflow-y-auto border-l px-3 py-4"
    >
      <div className="flex min-h-8 items-center gap-2 px-1">
        <h2 className="m-0 flex-1 text-sm font-semibold text-foreground-strong">
          Shared files
        </h2>
        <span className="text-xs text-foreground-faint">{summary}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <SharedFilesList {...list} />
    </aside>
  )
}
