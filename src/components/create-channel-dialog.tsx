import { HashIcon } from "lucide-react"
import { useState, type FormEvent } from "react"

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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import type { AgentWithState, Conversation } from "@/lib/agent-api"

type Draft = {
  name: string
  topic: string
  private: boolean
  replyMode: "mention" | "every"
  agentIds: string[]
}

const EMPTY: Draft = {
  name: "",
  topic: "",
  private: false,
  replyMode: "mention",
  agentIds: [],
}

export function CreateChannelDialog({
  open,
  agents,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  agents: AgentWithState[]
  onOpenChange: (open: boolean) => void
  onCreated: (conversation: Conversation) => void
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  const change = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }))

  function invite(agentId: string, on: boolean) {
    change(
      "agentIds",
      on
        ? [...draft.agentIds, agentId]
        : draft.agentIds.filter((id) => id !== agentId)
    )
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "channel", ...draft }),
    })
    const body = (await response.json()) as {
      conversation?: Conversation
      error?: string
    }
    if (!response.ok || !body.conversation) {
      setError(body.error ?? "The server did not create the channel.")
      return
    }
    setDraft(EMPTY)
    setError(null)
    onCreated(body.conversation)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <form onSubmit={create} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              A channel holds one topic. Invite the agents that work on it.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="channel-name">Name</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <HashIcon />
                </InputGroupAddon>
                <InputGroupInput
                  id="channel-name"
                  value={draft.name}
                  onChange={(event) =>
                    change("name", event.currentTarget.value)
                  }
                />
              </InputGroup>
              <FieldDescription>
                Lowercase letters, numbers and hyphens.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="channel-topic">Topic</FieldLabel>
              <Input
                id="channel-topic"
                value={draft.topic}
                onChange={(event) => change("topic", event.currentTarget.value)}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="channel-private">
                  Private channel
                </FieldLabel>
                <FieldDescription>
                  Only invited agents can see it.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="channel-private"
                checked={draft.private}
                onCheckedChange={(checked) => change("private", checked)}
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Invite agents</FieldLegend>
              <ItemGroup>
                {agents.map((agent) => (
                  <Item key={agent.id} size="sm" variant="outline">
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
                      <ItemDescription>
                        {agent.model} · {agent.permissionMode}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Checkbox
                        aria-label={`Invite ${agent.name}`}
                        checked={draft.agentIds.includes(agent.id)}
                        onCheckedChange={(on) => invite(agent.id, on)}
                      />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">When agents reply</FieldLegend>
              <RadioGroup
                value={draft.replyMode}
                onValueChange={(value) =>
                  change("replyMode", value === "every" ? "every" : "mention")
                }
              >
                <Field orientation="horizontal">
                  <RadioGroupItem value="mention" id="reply-mention" />
                  <FieldLabel htmlFor="reply-mention">
                    Only when @mentioned
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="every" id="reply-every" />
                  <FieldLabel htmlFor="reply-every">
                    Every message (each agent spends tokens on each message)
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
          {error && (
            <p role="alert" className="m-0 text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit">Create channel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
