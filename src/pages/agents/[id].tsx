import { CheckIcon } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
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

type Draft = Omit<Agent, "id" | "createdAt" | "systemPrompt"> & {
  systemPrompt: string
}

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
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    let current = true
    fetch(`/api/agents/${id}`)
      .then((response) => response.json() as Promise<{ agent: Agent }>)
      .then(({ agent }) => {
        if (current)
          setDraft({ ...agent, systemPrompt: agent.systemPrompt ?? "" })
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [id, isNew])

  const change = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }))

  async function save(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(isNew ? "/api/agents" : `/api/agents/${id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    })
    const body = (await response.json()) as { agent?: Agent; error?: string }
    if (!response.ok || !body.agent) {
      setError(body.error ?? "The server did not save the agent.")
      return
    }
    setError(null)
    if (isNew) navigate(`/agents/${body.agent.id}`)
  }

  return (
    <main className="min-h-svh bg-background px-8 pt-5 pb-8 text-sm text-foreground">
      <form onSubmit={save} className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 flex-1 text-xl font-semibold text-foreground-strong">
            {isNew ? "New agent" : draft.name}
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
                <Field>
                  <FieldLabel htmlFor="agent-name">Name</FieldLabel>
                  <Input
                    id="agent-name"
                    className="font-mono"
                    value={draft.name}
                    onChange={(event) =>
                      change("name", event.currentTarget.value)
                    }
                  />
                  <FieldDescription>
                    People type @{draft.name || "name"} to call it.
                  </FieldDescription>
                </Field>
                <FieldSet>
                  <FieldLegend variant="label">Colour</FieldLegend>
                  <RadioGroup
                    value={draft.colour}
                    onValueChange={(value) => change("colour", String(value))}
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
                <Field>
                  <FieldLabel htmlFor="agent-model">Model</FieldLabel>
                  <NativeSelect
                    id="agent-model"
                    className="font-mono"
                    value={draft.model}
                    onChange={(event) =>
                      change("model", event.currentTarget.value)
                    }
                  >
                    {MODELS.map((model) => (
                      <NativeSelectOption key={model} value={model}>
                        {model}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-mode">Permission mode</FieldLabel>
                  <NativeSelect
                    id="agent-mode"
                    className="font-mono"
                    value={draft.permissionMode}
                    onChange={(event) =>
                      change("permissionMode", event.currentTarget.value)
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
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent-cwd">Working directory</FieldLabel>
                  <Input
                    id="agent-cwd"
                    className="font-mono"
                    value={draft.cwd}
                    onChange={(event) =>
                      change("cwd", event.currentTarget.value)
                    }
                  />
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    id="agent-autostart"
                    checked={draft.autostart}
                    onCheckedChange={(checked) => change("autostart", checked)}
                  />
                  <FieldLabel htmlFor="agent-autostart">
                    Start when the app opens
                  </FieldLabel>
                </Field>
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
                <ToolRules
                  id="tool-allow"
                  label="Allowed tools"
                  inputLabel="Add an allowed tool"
                  placeholder="Add a tool, for example Bash(git status)"
                  rules={draft.allowedTools}
                  onChange={(rules) => change("allowedTools", rules)}
                />
                <ToolRules
                  id="tool-block"
                  label="Blocked tools"
                  inputLabel="Add a blocked tool"
                  placeholder="Add a tool, for example WebFetch"
                  rules={draft.disallowedTools}
                  blocked
                  onChange={(rules) => change("disallowedTools", rules)}
                />
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
              <Field>
                <FieldLabel htmlFor="agent-prompt">System prompt</FieldLabel>
                <Textarea
                  id="agent-prompt"
                  rows={8}
                  className="font-mono"
                  value={draft.systemPrompt}
                  onChange={(event) =>
                    change("systemPrompt", event.currentTarget.value)
                  }
                />
              </Field>
            </CardContent>
          </Card>
        </div>
      </form>
    </main>
  )
}
