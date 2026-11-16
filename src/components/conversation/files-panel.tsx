import { FileIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"

import { SharedFileRow } from "@/components/conversation/shared-files"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { fileNote } from "@/lib/files"
import { clockTime } from "@/lib/time"

export function SharedFilesList({
  files,
  entries,
  agents,
  onRemove,
}: {
  files: SharedFileView[]
  entries: TimelineEntry[]
  agents: AgentWithState[]
  onRemove: (file: SharedFileView) => void
}) {
  const [asking, setAsking] = useState<SharedFileView | null>(null)
  const listed = files.filter((file) => file.removedAt === null)
  const nameOf = (authorKey: string) =>
    agents.find((agent) => `agent:${agent.id}` === authorKey)?.name ??
    "an agent"
  if (listed.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileIcon />
          </EmptyMedia>
          <EmptyTitle>No shared files</EmptyTitle>
          <EmptyDescription>
            No files are shared here yet. Drop a file on the conversation to
            share it.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {listed.map((file) => (
          <li key={file.id}>
            <SharedFileRow
              file={file}
              state={file.exists ? file.kind : "missing"}
              note={`Shared by ${file.sharedBy} at ${clockTime(file.sharedAt)} · ${fileNote(file.path, entries, 0, nameOf)}`}
              canCopy={file.exists}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    file.kind === "copied" ? setAsking(file) : onRemove(file)
                  }
                >
                  <Trash2Icon />
                </Button>
              }
            />
          </li>
        ))}
      </ul>
      <AlertDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
      >
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{`Remove ${asking?.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              The copy in the uploads is deleted. The message keeps its name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (asking) onRemove(asking)
                setAsking(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

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
