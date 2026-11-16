import { useEffect, useId, useState } from "react"

import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
import { RefusalAlert } from "@/components/alerts/refusal-alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { refusalOf } from "@/lib/refusal"

export function AddMembersDialog({
  open,
  title,
  submitLabel,
  conversation,
  onOpenChange,
}: {
  open: boolean
  title: string
  submitLabel: string
  conversation: Conversation
  onOpenChange: (open: boolean) => void
}) {
  const [agents, setAgents] = useState<AgentWithState[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const headingId = useId()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let current = true
    fetch("/api/agents")
      .then(
        (response) => response.json() as Promise<{ agents: AgentWithState[] }>
      )
      .then(({ agents }) => {
        if (current) setAgents(agents)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [open])

  const outside = agents.filter(
    (agent) => !conversation.members.includes(`agent:${agent.id}`)
  )

  async function add() {
    const refusal = await refusalOf(
      fetch(`/api/conversations/${conversation.id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentIds: picked }),
      })
    )
    if (refusal) {
      setError(refusal)
      return
    }
    setPicked([])
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {conversation.replyMode === "mention"
              ? "A new member sees only the messages after it joins. It replies when someone @mentions it."
              : "A new member sees only the messages after it joins. It replies to every message."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          {error && (
            <RefusalAlert refusal={`${error} The agents were not added.`} />
          )}
          {outside.length === 0 ? (
            <p className="m-0 text-muted-foreground">
              Each agent is a member already.
            </p>
          ) : (
            <>
              <h3
                id={headingId}
                className="m-0 text-xs font-medium text-muted-foreground"
              >
                Agents that are not members
              </h3>
              <ItemGroup aria-labelledby={headingId} className="gap-2">
                {outside.map((agent) => (
                  <Item
                    key={agent.id}
                    size="sm"
                    variant="outline"
                    role="listitem"
                  >
                    <ItemMedia>
                      <Avatar size="sm">
                        <AvatarFallback
                          className={AVATAR_COLOURS[agent.colour]}
                        >
                          {initialsOf(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{agent.name}</ItemTitle>
                      <ItemDescription className="font-mono text-xs">
                        {agent.model} · {agent.permissionMode}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Checkbox
                        aria-label={`${submitLabel} ${agent.name}`}
                        checked={picked.includes(agent.id)}
                        onCheckedChange={(on) =>
                          setPicked((current) =>
                            on
                              ? [...current, agent.id]
                              : current.filter((id) => id !== agent.id)
                          )
                        }
                      />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </>
          )}
        </div>
        <DialogFooter>
          <span className="flex-1 self-center text-xs text-foreground-faint">
            {picked.length === 0
              ? "No agent picked"
              : `${picked.length} picked`}
          </span>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={picked.length === 0} onClick={() => void add()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
