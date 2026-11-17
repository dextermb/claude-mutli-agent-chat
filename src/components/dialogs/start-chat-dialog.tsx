import { SearchIcon, XIcon } from "lucide-react"
import { useId, useState } from "react"

import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { NO_ANSWER, replyOf } from "@/lib/refusal"
import { toastDone } from "@/lib/toasts"
import { shownName } from "../../../server/agent-names.ts"

export function StartChatDialog({
  open,
  agents,
  onOpenChange,
  onStarted,
}: {
  open: boolean
  agents: AgentWithState[]
  onOpenChange: (open: boolean) => void
  onStarted: (conversation: Conversation) => void
}) {
  const [search, setSearch] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const headingId = useId()

  const shown = agents.filter((agent) =>
    [agent.name, shownName(agent)].some((name) =>
      name.toLowerCase().includes(search.trim().toLowerCase())
    )
  )
  const pickedAgents = agents.filter((agent) => picked.includes(agent.id))
  const isGroup = picked.length > 1

  function toggle(agentId: string, on: boolean) {
    setPicked((current) =>
      on ? [...current, agentId] : current.filter((id) => id !== agentId)
    )
  }

  async function start() {
    setStarting(true)
    const reply = await replyOf<{
      conversation?: Conversation
      error?: string
    }>(
      fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isGroup
            ? { kind: "group", agentIds: picked }
            : { kind: "dm", agentId: picked[0] }
        ),
      })
    )
    setStarting(false)
    if (!reply) {
      setError(NO_ANSWER)
      return
    }
    const { body } = reply
    if (!reply.ok || !body.conversation) {
      setError(body.error ?? "The server did not start the chat.")
      return
    }
    toastDone(
      isGroup
        ? "The group chat is started."
        : `The DM with ${pickedAgents.map(shownName).join("")} is started.`
    )
    setPicked([])
    setSearch("")
    setError(null)
    onStarted(body.conversation)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Start a chat</DialogTitle>
          <DialogDescription>
            Pick one agent for a DM. Pick two or more agents for a group chat.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search agents"
              placeholder="Search agents"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </InputGroup>
          {pickedAgents.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="text-muted-foreground">To:</span>
              <ul
                aria-label="To"
                className="m-0 flex list-none flex-wrap gap-1.5 p-0"
              >
                {pickedAgents.map((agent) => (
                  <li key={agent.id}>
                    <Badge variant="secondary">
                      {shownName(agent)}
                      <button
                        type="button"
                        aria-label={`Remove ${shownName(agent)}`}
                        onClick={() => toggle(agent.id, false)}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Separator />
          <h3
            id={headingId}
            className="m-0 text-xs font-medium text-muted-foreground"
          >
            Agents
          </h3>
          <ItemGroup aria-labelledby={headingId}>
            {shown.map((agent) => (
              <Item key={agent.id} size="sm" role="listitem">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                      {initialsOf(shownName(agent))}
                    </AvatarFallback>
                    <AvatarBadge className={statusOf(agent.state).dot} />
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{shownName(agent)}</ItemTitle>
                  <ItemDescription>
                    {agent.model} · {statusOf(agent.state).label}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Checkbox
                    aria-label={`Pick ${shownName(agent)}`}
                    checked={picked.includes(agent.id)}
                    onCheckedChange={(on) => toggle(agent.id, on)}
                  />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {error && <RefusalAlert refusal={error} />}
        </div>
        <DialogFooter>
          <span className="flex-1 self-center text-xs text-foreground-faint">
            {picked.length === 0
              ? "No agent picked"
              : `${picked.length} picked: ${isGroup ? "a group chat" : "a DM"}`}
          </span>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={picked.length === 0 || starting}
            onClick={() => void start()}
          >
            {starting && <Spinner aria-hidden="true" />}
            {starting ? "Starting…" : isGroup ? "Start group chat" : "Open DM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
