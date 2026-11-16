import { z } from "zod"

function filled(message: string) {
  return z.string({ error: message }).trim().min(1, message)
}

function emptyAsNull() {
  return z
    .string()
    .nullish()
    .transform((value) => (value ? value : null))
}

function optionalFolder() {
  return z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null))
}

const SLEEP_TIME = "Give a whole number from 0 to 55, or leave it empty."

export const agentSchema = z.object({
  name: filled("Give the agent a name."),
  colour: z.string().default(""),
  model: filled("Pick a model."),
  permissionMode: filled("Pick a permission mode."),
  cwd: optionalFolder(),
  autostart: z.boolean().default(false),
  allowedTools: z.array(z.string()).default([]),
  disallowedTools: z
    .array(z.string())
    .default([])
    .refine(
      (tools) => !tools.some((tool) => /^ToolSearch(\(|$)/.test(tool.trim())),
      "Do not block ToolSearch. Without it, each request loads the schema of each MCP tool."
    ),
  systemPrompt: emptyAsNull(),
  description: emptyAsNull(),
  maxTurns: z
    .number({ error: "Give a whole number of 1 or more, or leave it empty." })
    .int("Give a whole number of 1 or more, or leave it empty.")
    .positive("Give a whole number of 1 or more, or leave it empty.")
    .nullable()
    .default(null),
  sleepAfterMinutes: sleepTime(),
})

function sleepTime() {
  return z
    .number({ error: SLEEP_TIME })
    .int(SLEEP_TIME)
    .min(0, SLEEP_TIME)
    .max(55, SLEEP_TIME)
    .nullish()
}

export const channelSchema = z.object({
  name: filled("Give the channel a name.").regex(
    /^[a-z0-9-]+$/,
    "Use only lowercase letters, numbers and hyphens in a channel name."
  ),
  topic: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null)),
  private: z.boolean().default(false),
  replyMode: z
    .enum(["mention", "every"], { error: "Pick a reply mode." })
    .default("mention"),
  cwd: optionalFolder(),
  sleepAfterMinutes: sleepTime(),
  agentIds: z.array(z.string()).default([]),
})

export const channelSettingsSchema = channelSchema.pick({
  topic: true,
  private: true,
  replyMode: true,
  cwd: true,
  sleepAfterMinutes: true,
})

export type AgentDraft = z.input<typeof agentSchema>

export type ChannelDraft = z.input<typeof channelSchema>

export type ChannelSettingsDraft = z.input<typeof channelSettingsSchema>

export type FieldErrors = Record<string, string>

export function checkBody<T extends z.ZodType>(
  schema: T,
  body: unknown
):
  | { ok: true; data: z.output<T> }
  | { ok: false; error: string; fields: FieldErrors } {
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }
  const fields: FieldErrors = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "")
    if (!(field in fields)) fields[field] = issue.message
  }
  return { ok: false, error: Object.values(fields).join(" "), fields }
}
