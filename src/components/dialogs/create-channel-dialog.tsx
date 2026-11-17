import { HashIcon } from "lucide-react"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"

import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
import { FolderField } from "@/components/fields/channel/folder-field"
import { PrivateField } from "@/components/fields/channel/private-field"
import { ReplyModeField } from "@/components/fields/channel/reply-mode-field"
import { RulesField } from "@/components/fields/channel/rules-field"
import { TopicField } from "@/components/fields/channel/topic-field"
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
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
import { Spinner } from "@/components/ui/spinner"
import type { AgentWithState, Conversation } from "@/lib/agent-api"
import { NO_ANSWER, replyOf } from "@/lib/refusal"
import { invalid, shown } from "@/lib/form-errors"
import { toastDone } from "@/lib/toasts"
import { channelSchema, type ChannelDraft } from "../../../server/schemas.ts"
import { shownName } from "../../../server/agent-names.ts"

const EMPTY: ChannelDraft = {
  name: "",
  topic: "",
  private: false,
  replyMode: "mention",
  cwd: "",
  rules: "",
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
    const reply = await replyOf<{
      conversation?: Conversation
      error?: string
    }>(
      fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "channel", ...draft }),
      })
    )
    if (!reply) {
      setError(NO_ANSWER)
      return
    }
    const { body } = reply
    if (!reply.ok || !body.conversation) {
      setError(body.error ?? "The server did not create the channel.")
      return
    }
    form.reset()
    setError(null)
    toastDone(`#${body.conversation.name} is created.`)
    onCreated(body.conversation)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
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
                <TopicField
                  value={field.state.value ?? ""}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
            <form.Field name="private">
              {(field) => (
                <PrivateField
                  checked={field.state.value ?? false}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
            <form.Field name="cwd">
              {(field) => (
                <FolderField
                  value={field.state.value ?? ""}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
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
                          {initialsOf(shownName(agent))}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{shownName(agent)}</ItemTitle>
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
                              aria-label={`Invite ${shownName(agent)}`}
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
            <form.Field name="replyMode">
              {(field) => (
                <ReplyModeField
                  value={field.state.value ?? "mention"}
                  onChange={field.handleChange}
                />
              )}
            </form.Field>
            <form.Field name="rules">
              {(field) => (
                <RulesField
                  place="channel"
                  value={field.state.value ?? ""}
                  errors={shown(field.state.meta)}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </FieldGroup>
          {error && <RefusalAlert refusal={error} />}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={submitting}>
                  {submitting && <Spinner aria-hidden="true" />}
                  {submitting ? "Creating…" : "Create channel"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
