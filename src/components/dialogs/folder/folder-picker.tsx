import { ArrowUpIcon, FolderIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { Button } from "@/components/ui/button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { fuzzyFilter } from "@/lib/fuzzy"
import type { FolderList } from "@/lib/folder-list"
import { replyOf, NO_ANSWER } from "@/lib/refusal"

export function FolderPicker({
  start,
  onPick,
}: {
  start: string
  onPick: (path: string) => void
}) {
  const [list, setList] = useState<FolderList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const shown = useMemo(() => {
    const folders = list?.folders ?? []
    const names = fuzzyFilter(
      filter,
      folders.map((folder) => folder.name)
    )
    return names.map((name) => folders.find((folder) => folder.name === name)!)
  }, [list, filter])

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
    setFilter("")
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
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Filter folders"
          placeholder="Filter folders"
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
      </InputGroup>
      <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-lg border p-1">
        {list?.folders.length === 0 && (
          <p className="m-0 p-2 text-[13px] text-foreground-faint">
            No folders in this folder.
          </p>
        )}
        {list && list.folders.length > 0 && shown.length === 0 && (
          <p className="m-0 p-2 text-[13px] text-foreground-faint">
            No folders match.
          </p>
        )}
        {shown.map((folder) => (
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
