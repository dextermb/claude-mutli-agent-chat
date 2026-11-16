import { ChevronDownIcon, UserPlusIcon, XIcon } from "lucide-react"

import {
  AVATAR_COLOURS,
  HUMAN_AVATAR,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { MemberSession } from "@/components/conversation/session/member-session"
import type { SessionDetailsProps } from "@/components/conversation/session/session-details"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AgentWithState } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function MembersPanel({
  asSheet,
  open,
  onClose,
  people,
  agents,
  pickedId,
  onPick,
  details,
  addLabel,
  onAdd,
}: {
  asSheet: boolean
  open: boolean
  onClose: () => void
  people: number
  agents: AgentWithState[]
  pickedId: string | null
  onPick: (agentId: string | null) => void
  details: SessionDetailsProps | null
  addLabel: string
  onAdd: () => void
}) {
  const count = `${people} ${people === 1 ? "person" : "people"} · ${
    agents.length
  } ${agents.length === 1 ? "agent" : "agents"}`
  const body = (
    <>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 rounded-[10px] p-2">
          <Avatar size="sm" aria-hidden="true">
            <AvatarFallback className={HUMAN_AVATAR}>Y</AvatarFallback>
          </Avatar>
          <span className="flex-1 font-medium text-foreground-strong">You</span>
        </div>
        {agents.map((agent) => {
          const status = statusOf(agent.state)
          const isOpen = agent.id === pickedId
          return (
            <div
              key={agent.id}
              className={cn("rounded-[10px]", isOpen && "bg-card")}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={`${agent.name} ${status.label}`}
                className="flex w-full items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-muted"
                onClick={() => onPick(isOpen ? null : agent.id)}
              >
                <Avatar size="sm" aria-hidden="true">
                  <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                    {initialsOf(agent.name)}
                  </AvatarFallback>
                  <AvatarBadge className={status.dot} />
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground-strong">
                    {agent.name}
                  </span>
                  <span className="truncate font-mono text-xs text-foreground-faint">
                    {agent.model}
                  </span>
                </span>
                <Badge variant="outline" className={status.text}>
                  {status.label}
                </Badge>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 text-foreground-faint transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && details && (
                <MemberSession key={agent.id} {...details} />
              )}
            </div>
          )
        })}
      </div>
      <Button variant="outline" className="self-start" onClick={onAdd}>
        <UserPlusIcon />
        {addLabel}
      </Button>
    </>
  )
  const note = (
    <p className="m-0 px-1 text-xs leading-[18px] text-foreground-faint">
      All members read and write this one thread. Each agent runs its own Claude
      Code process.
    </p>
  )

  if (asSheet) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="right"
          className="w-80 max-w-[85vw] gap-0 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Members</SheetTitle>
            <SheetDescription>{count}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-3 pb-4">
            {note}
            {body}
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  if (!open) return null
  return (
    <aside
      aria-label="Members"
      className="flex w-[360px] flex-none flex-col gap-3 overflow-y-auto border-l px-3 py-4"
    >
      <div className="flex min-h-8 items-center gap-2 px-1">
        <h2 className="m-0 flex-1 text-sm font-semibold text-foreground-strong">
          Members
        </h2>
        <span className="text-xs text-foreground-faint">{count}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      {note}
      {body}
    </aside>
  )
}
