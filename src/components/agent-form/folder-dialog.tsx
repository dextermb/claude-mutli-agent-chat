import { ArrowUpIcon, FolderIcon } from "lucide-react"
import { useEffect, useState } from "react"

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
import { replyOf, NO_ANSWER } from "@/lib/refusal"

type FolderList = {
  path: string
  parent: string | null
  folders: { name: string; path: string }[]
}

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

function FolderPicker({
  start,
  onPick,
}: {
  start: string
  onPick: (path: string) => void
}) {
  const [list, setList] = useState<FolderList | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function show(path: string | null) {
    const reply = await replyOf<FolderList & { error?: string }>(
      fetch(
        path === null
          ? "/api/folders"
          : `/api/folders?path=${encodeURIComponent(path)}`
      )
    )
    if (!reply) {
      setError(NO_ANSWER)
      return false
    }
    if (!reply.ok) {
      setError(reply.body.error ?? NO_ANSWER)
      return false
    }
    setError(null)
    setList(reply.body)
    return true
  }

  useEffect(() => {
    void (async () => {
      const opened = start.startsWith("/") && (await show(start))
      if (!opened) await show(null)
    })()
  }, [start])

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Pick a folder</DialogTitle>
        <DialogDescription>
          The agent runs Claude Code in this folder.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!list?.parent}
          onClick={() => list?.parent && void show(list.parent)}
        >
          <ArrowUpIcon />
          Up
        </Button>
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground-strong">
          {list?.path}
        </code>
      </div>
      <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
        {list?.folders.length === 0 && (
          <p className="m-0 p-2 text-[13px] text-foreground-faint">
            No folders in this folder.
          </p>
        )}
        {list?.folders.map((folder) => (
          <Button
            key={folder.path}
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start font-mono"
            onClick={() => void show(folder.path)}
          >
            <FolderIcon aria-hidden="true" />
            {folder.name}
          </Button>
        ))}
      </div>
      {error && <RefusalAlert refusal={error} />}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button
          type="button"
          disabled={!list}
          onClick={() => list && onPick(list.path)}
        >
          Use this folder
        </Button>
      </DialogFooter>
    </div>
  )
}
