import { useContext } from "react"

import {
  SharedFileRow,
  type SharedFileState,
} from "@/components/conversation/files/shared-file-row"
import { SharedFilesContext } from "@/components/conversation/files/shared-files-context"
import type { SharedFile } from "@/lib/agent-api"
import { fileNote } from "@/lib/files"
import { clockTime } from "@/lib/time"
import { shownName } from "../../../../server/agent-names.ts"

export function MessageFiles({
  files,
  afterSeq,
}: {
  files: SharedFile[]
  afterSeq: number
}) {
  const { files: list, entries, agents } = useContext(SharedFilesContext)
  const nameOf = (authorKey: string) => {
    const agent = agents.find((item) => `agent:${item.id}` === authorKey)
    return agent ? shownName(agent) : "an agent"
  }
  return (
    <ul
      aria-label="Shared files"
      className="m-0 flex max-w-[640px] list-none flex-col gap-1.5 p-0"
    >
      {files.map((file) => {
        const view = list.find((item) => item.path === file.path)
        const state: SharedFileState = view?.removedAt
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
