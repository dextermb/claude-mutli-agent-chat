import { useEffect, useState } from "react"

import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
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
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            An agent that joins sees the messages that come after it joins.
          </DialogDescription>
        </DialogHeader>
        {outside.length === 0 ? (
          <p className="m-0 text-muted-foreground">
            Each agent is a member already.
          </p>
        ) : (
          <ItemGroup>
            {outside.map((agent) => (
              <Item key={agent.id} size="sm">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
                      {initialsOf(agent.name)}
                    </AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{agent.name}</ItemTitle>
                  <ItemDescription>
                    {agent.model} · {agent.permissionMode}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Checkbox
                    aria-label={`Pick ${agent.name}`}
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
        )}
        {error && (
          <p role="alert" className="m-0 text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
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
