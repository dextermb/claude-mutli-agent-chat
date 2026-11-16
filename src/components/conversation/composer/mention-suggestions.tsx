import { FileIcon } from "lucide-react"

import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import type { PathOption } from "@/components/conversation/composer/path-option"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { AgentWithState } from "@/lib/agent-api"

type Member = Pick<AgentWithState, "id" | "name" | "colour" | "state">

export function MentionSuggestions({
  listId,
  members,
  files,
  activeIndex,
  onPickMember,
  onPickFile,
}: {
  listId: string
  members: Member[]
  files: PathOption[]
  activeIndex: number
  onPickMember: (name: string) => void
  onPickFile: (option: PathOption) => void
}) {
  return (
    <div className="flex max-w-sm flex-col gap-1 rounded-[14px] border bg-popover p-1.5 text-popover-foreground shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      {members.length > 0 && (
        <>
          <p
            id={`${listId}-label`}
            className="m-0 px-2 pt-1 text-xs font-medium text-muted-foreground"
          >
            Members
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={`${listId}-label`}
            className="m-0 flex list-none flex-col p-0"
          >
            {members.map((member, index) => {
              const status = statusOf(member.state)
              return (
                <li
                  key={member.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 aria-selected:bg-accent"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onPickMember(member.name)
                  }}
                >
                  <Avatar size="sm" aria-hidden="true">
                    <AvatarFallback className={AVATAR_COLOURS[member.colour]}>
                      {initialsOf(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium text-foreground-strong">
                    {member.name}
                  </span>{" "}
                  <Badge variant="outline" className={status.text}>
                    {status.label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {files.length > 0 && (
        <>
          <p
            id={`${listId}-files-label`}
            className="m-0 px-2 pt-1 text-xs font-medium text-muted-foreground"
          >
            Files
          </p>
          <ul
            id={`${listId}-files`}
            role="listbox"
            aria-labelledby={`${listId}-files-label`}
            className="m-0 flex list-none flex-col p-0"
          >
            {files.map((option, fileIndex) => {
              const index = members.length + fileIndex
              return (
                <li
                  key={option.path}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 aria-selected:bg-accent"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onPickFile(option)
                  }}
                >
                  <FileIcon
                    aria-hidden="true"
                    className="size-4 flex-none text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground-strong">
                    {option.relative}
                  </span>{" "}
                  <span className="flex-none text-xs text-foreground-faint">
                    {option.agentName}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
