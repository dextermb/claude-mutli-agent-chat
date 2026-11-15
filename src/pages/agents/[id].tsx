import { BotIcon, CheckIcon, FolderIcon, MenuIcon } from "lucide-react"
import { useForm } from "@tanstack/react-form"
import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "wouter"

import { CommandPreview } from "@/components/agent-form/command-preview"
import { FolderDialog } from "@/components/agent-form/folder-dialog"
import {
  AgentActions,
  type ActionRefusal,
} from "@/components/agent-form/agent-actions"
import { ToolRules } from "@/components/agent-form/tool-rules"
import { AppSidebar } from "@/components/app-sidebar"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { RefusalAlert } from "@/components/conversation/refusal-alert"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { Agent, Conversation } from "@/lib/agent-api"
import { invalid, shown } from "@/lib/form-errors"
import { agentSchema, type AgentDraft } from "../../../server/schemas.ts"

type Draft = AgentDraft

const COLOURS = ["orange", "yellow", "green", "aqua", "blue", "purple"]
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
const MODES = ["default", "acceptEdits", "plan", "bypassPermissions"]

const MODE_NOTES: Record<string, string> = {
  default:
    "With default, each tool outside the allowed list waits for approval in the chat.",
  acceptEdits:
    "acceptEdits changes files without a prompt. Other tools outside the allowed list wait for approval in the chat.",
  plan: "plan reads and plans, and changes no file. Other tools outside the allowed list wait for approval in the chat.",
  bypassPermissions:
    "bypassPermissions runs each tool without a prompt. Blocked tools still never run.",
}

const EMPTY: Draft = {
  name: "",
  colour: "green",
  model: "claude-sonnet-5-5",
  permissionMode: "default",
  cwd: "",
  autostart: false,
  allowedTools: [],
  disallowedTools: [],
  systemPrompt: "",
  description: "",
  maxTurns: null,
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === "new"
  const [error, setError] = useState<string | null>(null)
  const [actionRefusal, setActionRefusal] = useState<ActionRefusal | null>(null)
  const [showingSidebar, setShowingSidebar] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const isMobile = useIsMobile()
  const { agents, conversations } = useWorkspace()
  const [saved, setSaved] = useState<Draft | null>(null)

  const form = useForm({
    defaultValues: saved ?? EMPTY,
    validators: { onBlur: agentSchema, onSubmit: agentSchema },
    listeners: {
      onChange: ({ fieldApi }) =>
        fieldApi.setMeta((meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: undefined },
        })),
    },
    onSubmit: ({ value }) => save(value),
  })

  useEffect(() => {
    if (isNew) return
    let current = true
    fetch(`/api/agents/${id}`)
      .then((response) => response.json() as Promise<{ agent: Agent }>)
      .then(({ agent }) => {
        if (current) setSaved(draftOf(agent))
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [id, isNew])

  async function save(draft: Draft) {
    const response = await fetch(isNew ? "/api/agents" : `/api/agents/${id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    })
    const body = (await response.json()) as {
      agent?: Agent
      error?: string
      fields?: Record<string, string>
    }
    if (!response.ok || !body.agent) {
      setError(body.error ?? "The server did not save the agent.")
      for (const [name, message] of Object.entries(body.fields ?? {})) {
        if (!(name in EMPTY)) continue
        form.setFieldMeta(name as keyof Draft, (meta) => ({
          ...meta,
          isTouched: true,
          errorMap: { ...meta.errorMap, onServer: message },
        }))
      }
      return
    }
    setError(null)
    if (isNew) navigate(`/agents/${body.agent.id}`)
  }

  const agent = agents.find((item) => item.id === id)
  const directMessage = conversations.find(
    (item) => item.kind === "dm" && item.members.includes(`agent:${id}`)
  )

  return (
    <div className="flex h-svh bg-background text-sm text-foreground">
      <AppSidebar
        currentId={isNew ? "" : (directMessage?.id ?? "")}
        open={showingSidebar}
        onOpenChange={setShowingSidebar}
      />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-8 sm:px-8">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="flex flex-col gap-6"
        >
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open the sidebar"
                onClick={() => setShowingSidebar(true)}
              >
                <MenuIcon />
              </Button>
            )}
            <Link href="/" className="hover:text-foreground-strong">
              Agents
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">
              {isNew ? (
                "New agent"
              ) : (
                <form.Subscribe selector={(state) => state.values.name}>
                  {(name) => name}
                </form.Subscribe>
              )}
            </span>
          </nav>
          <header className="flex flex-wrap items-center gap-4">
            {isNew ? (
              <div
                aria-hidden="true"
                className="grid size-12 flex-none place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <BotIcon className="size-[22px]" />
              </div>
            ) : (
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <Avatar size="lg">
                    <AvatarFallback
                      className={AVATAR_COLOURS[values.colour ?? ""]}
                    >
                      {initialsOf(values.name)}
                    </AvatarFallback>
                    {agent && (
                      <AvatarBadge className={statusOf(agent.state).dot} />
                    )}
                  </Avatar>
                )}
              </form.Subscribe>
            )}
            <div className="flex min-w-60 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="m-0 text-xl font-semibold text-foreground-strong">
                  {isNew ? (
                    "New agent"
                  ) : (
                    <form.Subscribe selector={(state) => state.values.name}>
                      {(name) => name}
                    </form.Subscribe>
                  )}
                </h1>
                {agent && (
                  <Badge
                    variant="outline"
                    className={statusOf(agent.state).text}
                  >
                    {statusOf(agent.state).label}
                  </Badge>
                )}
              </div>
              <p className="m-0 text-muted-foreground">
                {isNew
                  ? "The agent starts when it gets its first message."
                  : placesOf(id, conversations)}
              </p>
            </div>
            {isNew && (
              <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                Cancel
              </Link>
            )}
            {agent && agent.state !== "exited" && (
              <AgentActions
                agentId={agent.id}
                agentName={agent.name}
                onRefusal={setActionRefusal}
              />
            )}
            <Button type="submit">
              <CheckIcon />
              {isNew ? "Create agent" : "Save agent"}
            </Button>
          </header>
          {error && (
            <RefusalAlert
              title="The server refused the agent."
              refusal={error}
            />
          )}
          {actionRefusal && (
            <RefusalAlert
              title={actionRefusal.title}
              refusal={actionRefusal.reason}
              onClose={() => setActionRefusal(null)}
            />
          )}
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>
                  How people see and mention the agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <form.Field name="name">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-name">Name</FieldLabel>
                        <Input
                          id="agent-name"
                          className="font-mono"
                          placeholder="test-runner"
                          value={field.state.value}
                          aria-invalid={invalid(field.state.meta)}
                          aria-describedby={
                            invalid(field.state.meta)
                              ? "agent-name-error"
                              : "agent-name-description"
                          }
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.currentTarget.value)
                          }
                        />
                        {!invalid(field.state.meta) && (
                          <FieldDescription id="agent-name-description">
                            People type @{field.state.value || "name"} to call
                            it.
                          </FieldDescription>
                        )}
                        <FieldError
                          id="agent-name-error"
                          errors={shown(field.state.meta)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="colour">
                    {(field) => (
                      <FieldSet>
                        <FieldLegend variant="label">Colour</FieldLegend>
                        <RadioGroup
                          value={field.state.value}
                          onValueChange={(value) =>
                            field.handleChange(String(value))
                          }
                          className="flex flex-wrap gap-x-4 gap-y-2"
                        >
                          {COLOURS.map((colour) => (
                            <Field
                              key={colour}
                              orientation="horizontal"
                              className="w-auto"
                            >
                              <RadioGroupItem
                                value={colour}
                                id={`colour-${colour}`}
                              />
                              <FieldLabel htmlFor={`colour-${colour}`}>
                                <span
                                  aria-hidden="true"
                                  className={`inline-block size-3 rounded-full ${AVATAR_COLOURS[colour]}`}
                                />
                                {colour}
                              </FieldLabel>
                            </Field>
                          ))}
                        </RadioGroup>
                      </FieldSet>
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor="agent-description">
                          Description
                        </FieldLabel>
                        <Input
                          id="agent-description"
                          placeholder="Runs and fixes the Vitest tests."
                          value={field.state.value ?? ""}
                          onChange={(event) =>
                            field.handleChange(event.currentTarget.value)
                          }
                        />
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Runtime</CardTitle>
                <CardDescription>
                  How Claude Code starts this agent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <form.Field name="model">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-model">Model</FieldLabel>
                        <Choice
                          id="agent-model"
                          options={MODELS}
                          value={field.state.value}
                          invalid={invalid(field.state.meta)}
                          onBlur={field.handleBlur}
                          onChange={(value) => field.handleChange(value)}
                        />
                        <FieldError errors={shown(field.state.meta)} />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="permissionMode">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-mode">
                          Permission mode
                        </FieldLabel>
                        <Choice
                          id="agent-mode"
                          options={MODES}
                          value={field.state.value}
                          invalid={invalid(field.state.meta)}
                          onBlur={field.handleBlur}
                          onChange={(value) => field.handleChange(value)}
                        />
                        <FieldDescription>
                          {MODE_NOTES[field.state.value]}
                        </FieldDescription>
                        <FieldError errors={shown(field.state.meta)} />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="cwd">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-cwd">
                          Working directory
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <FolderIcon aria-hidden="true" />
                          </InputGroupAddon>
                          <InputGroupInput
                            id="agent-cwd"
                            className="font-mono"
                            placeholder="~/code/web-app"
                            value={field.state.value}
                            aria-invalid={invalid(field.state.meta)}
                            aria-describedby={
                              invalid(field.state.meta)
                                ? "agent-cwd-error"
                                : undefined
                            }
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.currentTarget.value)
                            }
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              size="xs"
                              onClick={() => setBrowsing(true)}
                            >
                              Browse
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldError
                          id="agent-cwd-error"
                          errors={shown(field.state.meta)}
                        />
                        <FolderDialog
                          open={browsing}
                          start={field.state.value}
                          onOpenChange={setBrowsing}
                          onPick={(path) => {
                            field.handleChange(path)
                            setBrowsing(false)
                          }}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="maxTurns">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-turns">
                          Maximum turns
                        </FieldLabel>
                        <Input
                          id="agent-turns"
                          type="number"
                          min={1}
                          step={1}
                          className="w-36 font-mono"
                          value={field.state.value ?? ""}
                          aria-invalid={invalid(field.state.meta)}
                          aria-describedby={
                            invalid(field.state.meta)
                              ? "agent-turns-error"
                              : "agent-turns-description"
                          }
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(
                              event.currentTarget.value === ""
                                ? null
                                : Number(event.currentTarget.value)
                            )
                          }
                        />
                        {!invalid(field.state.meta) && (
                          <FieldDescription id="agent-turns-description">
                            The most turns for each message. Leave it empty for
                            no limit.
                          </FieldDescription>
                        )}
                        <FieldError
                          id="agent-turns-error"
                          errors={shown(field.state.meta)}
                        />
                      </Field>
                    )}
                  </form.Field>
                  <form.Field name="autostart">
                    {(field) => (
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldLabel htmlFor="agent-autostart">
                            Start when the app opens
                          </FieldLabel>
                          <FieldDescription>
                            The server starts the DM process of the agent at
                            each start.
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="agent-autostart"
                          checked={field.state.value}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked)
                          }
                        />
                      </Field>
                    )}
                  </form.Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tools</CardTitle>
                <CardDescription>
                  Allowed tools run without a prompt. Blocked tools never run.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <form.Field name="allowedTools">
                    {(field) => (
                      <ToolRules
                        id="tool-allow"
                        label="Allowed tools"
                        inputLabel="Add an allowed tool"
                        placeholder="Add a tool, for example Bash(git status)"
                        empty="No allowed tools. Each tool waits for your approval."
                        rules={field.state.value ?? []}
                        onChange={(rules) => field.handleChange(rules)}
                      />
                    )}
                  </form.Field>
                  <form.Field name="disallowedTools">
                    {(field) => (
                      <ToolRules
                        id="tool-block"
                        label="Blocked tools"
                        inputLabel="Add a blocked tool"
                        placeholder="Block a tool, for example WebFetch"
                        rules={field.state.value ?? []}
                        blocked
                        onChange={(rules) => field.handleChange(rules)}
                      />
                    )}
                  </form.Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
                <CardDescription>
                  Added to the Claude Code system prompt. This is optional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form.Field name="systemPrompt">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="agent-prompt">
                        System prompt
                      </FieldLabel>
                      <Textarea
                        id="agent-prompt"
                        rows={8}
                        className="font-mono"
                        placeholder="Write what the agent does and when it stops."
                        value={field.state.value ?? ""}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.value)
                        }
                      />
                      <FieldDescription>
                        Keep repo rules in CLAUDE.md. The agent loads them.
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
              </CardContent>
            </Card>
          </div>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <CommandPreview
                agent={{
                  model: values.model,
                  permissionMode: values.permissionMode,
                  allowedTools: values.allowedTools ?? [],
                  disallowedTools: values.disallowedTools ?? [],
                  systemPrompt: values.systemPrompt || null,
                  maxTurns: values.maxTurns ?? null,
                }}
                cwd={values.cwd}
              />
            )}
          </form.Subscribe>
        </form>
      </main>
    </div>
  )
}

function draftOf(agent: Agent): Draft {
  return {
    name: agent.name,
    colour: agent.colour,
    model: agent.model,
    permissionMode: agent.permissionMode,
    cwd: agent.cwd,
    autostart: agent.autostart,
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    systemPrompt: agent.systemPrompt ?? "",
    description: agent.description ?? "",
    maxTurns: agent.maxTurns,
  }
}

function Choice({
  id,
  options,
  value,
  invalid,
  onBlur,
  onChange,
}: {
  id: string
  options: string[]
  value: string
  invalid: boolean
  onBlur: () => void
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next))}>
      <SelectTrigger
        id={id}
        className="w-full font-mono"
        aria-invalid={invalid}
        onBlur={onBlur}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="font-mono">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function placesOf(agentId: string, conversations: Conversation[]): string {
  const memberOf = conversations.filter((item) =>
    item.members.includes(`agent:${agentId}`)
  )
  const count = (kind: Conversation["kind"], one: string, many: string) => {
    const total = memberOf.filter((item) => item.kind === kind).length
    return total === 0 ? null : `${total} ${total === 1 ? one : many}`
  }
  const places = [
    count("channel", "channel", "channels"),
    count("group", "group chat", "group chats"),
  ].filter(Boolean)
  return places.length === 0
    ? "Headless Claude Code agent."
    : `Headless Claude Code agent. Runs in ${places.join(" and ")}.`
}
