import { BotIcon, HouseIcon } from "lucide-react"
import { Link } from "wouter"

import { HUMAN_AVATAR } from "@/components/conversation/agent-look"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"

export function WorkspaceRail({ onAgents }: { onAgents: boolean }) {
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
        aria-label="Agents"
        className={buttonVariants({
          variant: onAgents ? "secondary" : "ghost",
          size: "icon",
        })}
      >
        <BotIcon />
      </Link>
      <div className="flex-1" />
      <Avatar role="img" aria-label="You, online">
        <AvatarFallback className={HUMAN_AVATAR}>Y</AvatarFallback>
        <AvatarBadge className="bg-status-online" />
      </Avatar>
    </nav>
  )
}
