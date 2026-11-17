import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  FolderIcon,
  MenuIcon,
} from "lucide-react"
import { useForm, useStore } from "@tanstack/react-form"
import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "wouter"

import { CommandPreview } from "@/components/agent-form/command-preview"
import { ColourSwatches } from "@/components/agent-form/colour-swatches"
import { ModeChoice } from "@/components/agent-form/mode-choice"
import { DeleteDialog } from "@/components/dialogs/delete-dialog"
import { DeleteSection } from "@/components/dialogs/delete-section"
import { FolderDialog } from "@/components/dialogs/folder/folder-dialog"
import { OnThisPage, type PageSection } from "@/components/forms/on-this-page"
import { FormBar } from "@/components/forms/form-bar"
import { SettingsSection } from "@/components/forms/settings-section"
import { AgentActions } from "@/components/agent-actions/agent-actions"
import { ToolRules } from "@/components/agent-form/tool-rules"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import {
  AVATAR_COLOURS,
  initialsOf,
  statusOf,
} from "@/components/conversation/agent-look"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { useWorkspace } from "@/hooks/use-workspace"
import type { Agent, Conversation } from "@/lib/agent-api"
import { changedFields, unsavedText } from "@/lib/changed-fields"
import { toastDone, toastRefusal } from "@/lib/toasts"
import { agentTarget, type DeleteTarget } from "@/lib/delete-targets"
import { fixText, invalid, shown } from "@/lib/form-errors"
import { agentSchema, type AgentDraft } from "../../../server/schemas.ts"

type Draft = AgentDraft

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
const USUAL_TOOLS = ["Read", "Edit", "Write", "Bash(git status)"]
const SECTIONS: (PageSection & { fields: (keyof Draft)[] })[] = [
  {
    id: "identity",
    title: "Identity",
    fields: ["name", "colour", "description"],
  },
  {
    id: "model",
    title: "Model and permissions",
    fields: ["model", "permissionMode"],
  },
  {
    id: "folder",
    title: "Folder and limits",
    fields: ["cwd", "maxTurns", "sleepAfterMinutes", "autostart"],
  },
  { id: "tools", title: "Tools", fields: ["allowedTools", "disallowedTools"] },
  { id: "instructions", title: "Instructions", fields: ["systemPrompt"] },
  { id: "command", title: "Command", fields: [] },
]
const LABELS: Record<keyof Draft, string> = {
  name: "Name",
  colour: "Colour",
  description: "Description",
  model: "Model",
  permissionMode: "Permission mode",
  cwd: "Working directory",
  maxTurns: "Maximum turns",
  sleepAfterMinutes: "Sleep after",
  autostart: "Start when the app opens",
  allowedTools: "Allowed tools",
  disallowedTools: "Blocked tools",
  systemPrompt: "System prompt",
}
const EMPTY: Draft = {
  name: "",
  colour: "green",
  model: "claude-sonnet-5-5",
  permissionMode: "manual",
  cwd: "",
  autostart: false,
  allowedTools: [],
  disallowedTools: [],
  systemPrompt: "",
  description: "",
  maxTurns: null,
  sleepAfterMinutes: null,
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === "new"
  const [showingSidebar, setShowingSidebar] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const isMobile = useIsMobile()
  const { agents, conversations } = useWorkspace()
  const [saved, setSaved] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const listed = agents.find((agent) => agent.id === id)

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
      toastRefusal(
        "The server refused the agent.",
        body.error ?? "The server did not save the agent."
      )
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
    toastDone(`${body.agent.name} is ${isNew ? "created" : "saved"}.`)
    if (isNew) navigate(`/agents/${body.agent.id}`)
    else setSaved(draft)
  }

  const values = useStore(form.store, (state) => state.values)
  const changed = saved ? changedFields(values, saved) : []
  const fieldMeta = useStore(form.store, (state) => state.fieldMeta)
  const toFix = (Object.keys(LABELS) as (keyof Draft)[])
    .filter((name) => {
      const meta = fieldMeta[name]
      return meta !== undefined && invalid(meta)
    })
    .map((name) => LABELS[name])
  const sections = SECTIONS.map((section) => ({
    ...section,
    changed: section.fields.some((name) => changed.includes(name)),
  }))
  const changedIn = (sectionId: string) =>
    sections.find((section) => section.id === sectionId)?.changed ?? false

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
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
          className="flex flex-1 flex-col"
        >
          <div className="flex flex-1 items-start justify-center gap-12 px-4 pt-5 pb-10 sm:px-8">
            <div className="flex w-full max-w-[760px] min-w-0 flex-col gap-7">
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
                      ? "A headless Claude Code agent. Only the name is necessary."
                      : placesOf(id, conversations)}
                  </p>
                </div>
                {agent && agent.state !== "exited" && (
                  <AgentActions agentId={agent.id} agentName={agent.name} />
                )}
              </header>
              <SettingsSection
                id="identity"
                changed={changedIn("identity")}
                title="Identity"
                description="How people see and mention the agent."
              >
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
                      <ColourSwatches
                        value={field.state.value ?? "green"}
                        onChange={(value) => field.handleChange(value)}
                      />
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
              </SettingsSection>

              <SettingsSection
                id="model"
                changed={changedIn("model")}
                title="Model and permissions"
                description="Which model runs, and what it can do without your approval."
              >
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
                      <ModeChoice
                        value={field.state.value}
                        errors={shown(field.state.meta)}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>
                </FieldGroup>
              </SettingsSection>

              <SettingsSection
                id="folder"
                changed={changedIn("folder")}
                title="Folder and limits"
                description="Where the agent works, and when it stops."
              >
                <FieldGroup>
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
                            value={field.state.value ?? ""}
                            aria-invalid={invalid(field.state.meta)}
                            aria-describedby={
                              invalid(field.state.meta)
                                ? "agent-cwd-description agent-cwd-error"
                                : "agent-cwd-description"
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
                        <FieldDescription id="agent-cwd-description">
                          Empty: the agent works in the folder of each channel,
                          or in a scratch folder.
                        </FieldDescription>
                        <FieldError
                          id="agent-cwd-error"
                          errors={shown(field.state.meta)}
                        />
                        <FolderDialog
                          open={browsing}
                          start={field.state.value ?? ""}
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
                  <form.Field name="sleepAfterMinutes">
                    {(field) => (
                      <Field data-invalid={invalid(field.state.meta)}>
                        <FieldLabel htmlFor="agent-sleep">
                          Sleep after (minutes)
                        </FieldLabel>
                        <Input
                          id="agent-sleep"
                          type="number"
                          min={0}
                          max={55}
                          step={1}
                          className="w-36 font-mono"
                          value={field.state.value ?? ""}
                          aria-invalid={invalid(field.state.meta)}
                          aria-describedby={
                            invalid(field.state.meta)
                              ? "agent-sleep-error"
                              : "agent-sleep-description"
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
                          <FieldDescription id="agent-sleep-description">
                            After this idle time, the agent saves its memory and
                            its process stops. Empty: the app value. 0: never. A
                            channel can set its own time.
                          </FieldDescription>
                        )}
                        <FieldError
                          id="agent-sleep-error"
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
              </SettingsSection>

              <SettingsSection
                id="tools"
                changed={changedIn("tools")}
                title="Tools"
                description="Allowed tools run without a prompt. Blocked tools never run."
              >
                <FieldGroup>
                  <form.Field name="allowedTools">
                    {(field) => (
                      <ToolRules
                        id="tool-allow"
                        label="Allowed tools"
                        inputLabel="Add an allowed tool"
                        placeholder="Add a tool, for example Bash(git status)"
                        empty="No allowed tools. Each tool waits for your approval."
                        usual={USUAL_TOOLS}
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
                        errors={shown(field.state.meta)}
                        onChange={(rules) => field.handleChange(rules)}
                      />
                    )}
                  </form.Field>
                </FieldGroup>
              </SettingsSection>

              <SettingsSection
                id="instructions"
                changed={changedIn("instructions")}
                title="Instructions"
                description="Added to the Claude Code system prompt. Keep repo rules in CLAUDE.md. The agent loads them."
              >
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
              </SettingsSection>
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <CommandPreview
                    id="command"
                    agent={{
                      model: values.model,
                      permissionMode: values.permissionMode,
                      allowedTools: values.allowedTools ?? [],
                      disallowedTools: values.disallowedTools ?? [],
                      systemPrompt: values.systemPrompt || null,
                      maxTurns: values.maxTurns ?? null,
                    }}
                    cwd={values.cwd ?? ""}
                  />
                )}
              </form.Subscribe>
              {!isNew && listed && (
                <DeleteSection
                  action="Delete agent"
                  text={`${listed.name} leaves each channel and group chat, and its DM is deleted. Its files stay.`}
                  onDelete={() =>
                    setDeleting(agentTarget(listed, conversations))
                  }
                  className="rounded-xl px-5 py-4"
                />
              )}
            </div>
            <OnThisPage sections={sections} />
          </div>
          <FormBar
            status={
              toFix.length > 0 ? (
                <span className="flex items-center gap-2 text-foreground-strong">
                  <CircleAlertIcon
                    aria-hidden="true"
                    className="size-4 flex-none text-destructive"
                  />
                  {fixText(toFix)}
                </span>
              ) : isNew ? (
                "The agent starts when it gets its first message."
              ) : (
                <>
                  <span className="font-medium text-foreground-strong">
                    {unsavedText(changed.length)}
                  </span>
                  {changed.length > 0 && (
                    <span className="text-xs">
                      The process that runs now keeps the old values.
                    </span>
                  )}
                </>
              )
            }
          >
            {isNew ? (
              <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                Cancel
              </Link>
            ) : (
              changed.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                >
                  Discard
                </Button>
              )
            )}
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Spinner aria-hidden="true" /> : <CheckIcon />}
                  {submitting
                    ? isNew
                      ? "Creating…"
                      : "Saving…"
                    : isNew
                      ? "Create agent"
                      : "Save agent"}
                </Button>
              )}
            </form.Subscribe>
          </FormBar>
        </form>
        <DeleteDialog
          target={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          onDeleted={() => {
            setDeleting(null)
            navigate("/")
          }}
        />
      </main>
    </div>
  )
}

function draftOf(agent: Agent): Draft {
  return {
    name: agent.name,
    colour: agent.colour,
    model: agent.model,
    permissionMode:
      agent.permissionMode === "default" ? "manual" : agent.permissionMode,
    cwd: agent.cwd ?? "",
    autostart: agent.autostart,
    allowedTools: agent.allowedTools,
    disallowedTools: agent.disallowedTools,
    systemPrompt: agent.systemPrompt ?? "",
    description: agent.description ?? "",
    maxTurns: agent.maxTurns,
    sleepAfterMinutes: agent.sleepAfterMinutes,
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
