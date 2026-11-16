import { CopyIcon, FileIcon } from "lucide-react"
import { createContext, useContext } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  AgentWithState,
  SharedFile,
  SharedFileView,
  TimelineEntry,
} from "@/lib/agent-api"
import { fileNote } from "@/lib/files"
import { clockTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export type SharedFilesState = {
  files: SharedFileView[]
  entries: TimelineEntry[]
  agents: AgentWithState[]
}

export const SharedFilesContext = createContext<SharedFilesState>({
  files: [],
  entries: [],
  agents: [],
})

type State = "linked" | "copied" | "removed" | "missing"

const BADGES: Record<State, { text: string; className: string }> = {
  linked: { text: "Linked", className: "text-status-online" },
  copied: { text: "Copied", className: "text-muted-foreground" },
  removed: { text: "Removed", className: "text-muted-foreground" },
  missing: { text: "Missing", className: "text-status-error" },
}

export function MessageFiles({
  files,
  afterSeq,
}: {
  files: SharedFile[]
  afterSeq: number
}) {
  const { files: list, entries, agents } = useContext(SharedFilesContext)
  const nameOf = (authorKey: string) =>
    agents.find((agent) => `agent:${agent.id}` === authorKey)?.name ??
    "an agent"
  return (
    <ul
      aria-label="Shared files"
      className="m-0 flex max-w-[640px] list-none flex-col gap-1.5 p-0"
    >
      {files.map((file) => {
        const view = list.find((item) => item.path === file.path)
        const state: State = view?.removedAt
          ? "removed"
          : view && !view.exists
            ? "missing"
            : file.kind
        const note =
          state === "removed" && view?.removedAt
            ? `Removed from the shared files at ${clockTime(view.removedAt)}.`
            : state === "missing"
              ? "The file is not there any more. Drop it again to share it."
              : fileNote(file.path, entries, afterSeq, nameOf)
        const gone =
          state === "missing" || (state === "removed" && file.kind === "copied")
        return (
          <li key={file.path}>
            <SharedFileRow
              file={file}
              state={state}
              note={note}
              canCopy={!gone}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function SharedFileRow({
  file,
  state,
  note,
  canCopy,
  action,
}: {
  file: Pick<SharedFile, "name" | "path">
  state: State
  note: string
  canCopy: boolean
  action?: React.ReactNode
}) {
  const badge = BADGES[state]
  return (
    <Item
      size="sm"
      variant="outline"
      className={cn(
        "flex-nowrap bg-rail",
        (state === "removed" || state === "missing") && "opacity-70"
      )}
    >
      <ItemMedia variant="icon">
        <FileIcon />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <span className="truncate">{file.name}</span>
          <Badge variant="outline" className={badge.className}>
            {badge.text}
          </Badge>
        </ItemTitle>
        <ItemDescription className="truncate font-mono">
          {file.path}
        </ItemDescription>
        <ItemDescription
          className={cn(state === "missing" && "text-status-error")}
        >
          {note}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {canCopy && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Copy the path of ${file.name}`}
                  onClick={() => {
                    void navigator.clipboard.writeText(file.path)
                  }}
                />
              }
            >
              <CopyIcon />
            </TooltipTrigger>
            <TooltipContent>Copy the path</TooltipContent>
          </Tooltip>
        )}
        {action}
      </ItemActions>
    </Item>
  )
}
