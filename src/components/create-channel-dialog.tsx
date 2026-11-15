import { HashIcon } from "lucide-react"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"

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
  FieldError,
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
import { invalid, shown } from "@/lib/form-errors"
import { channelSchema, type ChannelDraft } from "../../server/schemas.ts"

const EMPTY: ChannelDraft = {
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
  const [error, setError] = useState<string | null>(null)
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onBlur: channelSchema, onSubmit: channelSchema },
    onSubmit: ({ value }) => create(value),
  })

  async function create(draft: ChannelDraft) {
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
    form.reset()
    setError(null)
    onCreated(body.conversation)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              A channel holds one topic. Invite the agents that work on it.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <Field data-invalid={invalid(field.state.meta)}>
                  <FieldLabel htmlFor="channel-name">Name</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <HashIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="channel-name"
                      value={field.state.value}
                      aria-invalid={invalid(field.state.meta)}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.currentTarget.value)
                      }
                    />
                  </InputGroup>
                  <FieldDescription>
                    Lowercase letters, numbers and hyphens.
                  </FieldDescription>
                  <FieldError errors={shown(field.state.meta)} />
                </Field>
              )}
            </form.Field>
            <form.Field name="topic">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="channel-topic">Topic</FieldLabel>
                  <Input
                    id="channel-topic"
                    value={field.state.value ?? ""}
                    onChange={(event) =>
                      field.handleChange(event.currentTarget.value)
                    }
                  />
                </Field>
              )}
            </form.Field>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="channel-private">
                  Private channel
                </FieldLabel>
                <FieldDescription>
                  Only invited agents can see it.
                </FieldDescription>
              </FieldContent>
              <form.Field name="private">
                {(field) => (
                  <Switch
                    id="channel-private"
                    checked={field.state.value ?? false}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                  />
                )}
              </form.Field>
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
                      <form.Field name="agentIds">
                        {(field) => {
                          const picked = field.state.value ?? []
                          return (
                            <Checkbox
                              aria-label={`Invite ${agent.name}`}
                              checked={picked.includes(agent.id)}
                              onCheckedChange={(on) =>
                                field.handleChange(
                                  on
                                    ? [...picked, agent.id]
                                    : picked.filter((id) => id !== agent.id)
                                )
                              }
                            />
                          )
                        }}
                      </form.Field>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">When agents reply</FieldLegend>
              <form.Field name="replyMode">
                {(field) => (
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(
                        value === "every" ? "every" : "mention"
                      )
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
                )}
              </form.Field>
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
