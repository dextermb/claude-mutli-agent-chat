import { CheckIcon } from "lucide-react"
import { useForm } from "@tanstack/react-form"
import { useEffect, useState } from "react"
import { useLocation, useParams } from "wouter"

import { ToolRules } from "@/components/agent-form/tool-rules"
import { AVATAR_COLOURS } from "@/components/conversation/agent-look"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Agent } from "@/lib/agent-api"
import { invalid, shown } from "@/lib/form-errors"
import { agentSchema, type AgentDraft } from "../../../server/schemas.ts"

type Draft = AgentDraft

const COLOURS = ["orange", "yellow", "green", "aqua", "blue", "purple"]
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]
const MODES = ["default", "acceptEdits", "plan", "bypassPermissions"]

const EMPTY: Draft = {
  name: "",
  colour: "aqua",
  model: "claude-sonnet-5-5",
  permissionMode: "default",
  cwd: "",
  autostart: false,
  allowedTools: [],
  disallowedTools: [],
  systemPrompt: "",
}

export default function AgentPage() {
  const { id } = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const isNew = id === "new"
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: EMPTY,
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
        if (current) form.reset(draftOf(agent))
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [id, isNew, form])

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

  return (
    <main className="min-h-svh bg-background px-8 pt-5 pb-8 text-sm text-foreground">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        className="flex flex-col gap-6"
      >
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 flex-1 text-xl font-semibold text-foreground-strong">
            {isNew ? (
              "New agent"
            ) : (
              <form.Subscribe selector={(state) => state.values.name}>
                {(name) => name}
              </form.Subscribe>
            )}
          </h1>
          <Button type="submit">
            <CheckIcon />
            Save agent
          </Button>
        </header>
        {error && (
          <p role="alert" className="m-0 text-destructive">
            {error}
          </p>
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
                        value={field.state.value}
                        aria-invalid={invalid(field.state.meta)}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.value)
                        }
                      />
                      <FieldDescription>
                        People type @{field.state.value || "name"} to call it.
                      </FieldDescription>
                      <FieldError errors={shown(field.state.meta)} />
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
                      <NativeSelect
                        id="agent-model"
                        className="font-mono"
                        value={field.state.value}
                        aria-invalid={invalid(field.state.meta)}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.value)
                        }
                      >
                        {MODELS.map((model) => (
                          <NativeSelectOption key={model} value={model}>
                            {model}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
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
                      <NativeSelect
                        id="agent-mode"
                        className="font-mono"
                        value={field.state.value}
                        aria-invalid={invalid(field.state.meta)}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.value)
                        }
                      >
                        {MODES.map((mode) => (
                          <NativeSelectOption key={mode} value={mode}>
                            {mode}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldDescription>
                        Tools outside the allowed list wait for approval in the
                        chat.
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
                      <Input
                        id="agent-cwd"
                        className="font-mono"
                        value={field.state.value}
                        aria-invalid={invalid(field.state.meta)}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.currentTarget.value)
                        }
                      />
                      <FieldError errors={shown(field.state.meta)} />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="autostart">
                  {(field) => (
                    <Field orientation="horizontal">
                      <Switch
                        id="agent-autostart"
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                      />
                      <FieldLabel htmlFor="agent-autostart">
                        Start when the app opens
                      </FieldLabel>
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
                      placeholder="Add a tool, for example WebFetch"
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
                Added to the Claude Code system prompt.
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
                      value={field.state.value ?? ""}
                      onChange={(event) =>
                        field.handleChange(event.currentTarget.value)
                      }
                    />
                  </Field>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
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
  }
}
