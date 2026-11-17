import { BotIcon, HouseIcon, PanelLeftIcon } from "lucide-react"
import { Link } from "wouter"

import { HUMAN_AVATAR, statusOf } from "@/components/conversation/agent-look"
import { workSummary } from "@/components/sidebar/work-summary"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import type { AgentWithState } from "@/lib/agent-api"
import { cn } from "@/lib/utils"

export function WorkspaceRail({
  onAgents,
  listHidden,
  canCollapse,
  unread,
  agents,
  onToggleList,
}: {
  onAgents: boolean
  listHidden: boolean
  canCollapse: boolean
  unread: number
  agents: AgentWithState[]
  onToggleList: () => void
}) {
  const work = workSummary(agents)
  const showWork = listHidden && work !== null
  const toggleLabel = !listHidden
    ? "Hide the sidebar"
    : unread > 0
      ? `Show the sidebar, ${unread} unread`
      : "Show the sidebar"

  return (
    <nav
      aria-label="Workspace"
      className="flex w-16 flex-none flex-col items-center gap-2 bg-rail py-3"
    >
      <div
        aria-hidden="true"
        className="mb-2 grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        AL
      </div>
      {canCollapse && (
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={toggleLabel}
          onClick={onToggleList}
        >
          <PanelLeftIcon />
          {listHidden && unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 rounded-full border-2 border-rail bg-mention px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      )}
      <Link
        href="/"
        aria-label="Home"
        className={buttonVariants({
          variant: onAgents ? "ghost" : "secondary",
          size: "icon",
        })}
      >
        <HouseIcon />
      </Link>
      <Link
        href="/"
        aria-label={showWork ? ["Agents", ...work.parts].join(", ") : "Agents"}
        className={cn(
          "relative",
          buttonVariants({
            variant: onAgents ? "secondary" : "ghost",
            size: "icon",
          })
        )}
      >
        <BotIcon />
        {showWork && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-rail",
              statusOf(work.state).dot
            )}
          />
        )}
      </Link>
      <div className="flex-1" />
      <Avatar role="img" aria-label="You, online">
        <AvatarFallback className={HUMAN_AVATAR}>Y</AvatarFallback>
        <AvatarBadge className="bg-status-online" />
      </Avatar>
    </nav>
  )
}
