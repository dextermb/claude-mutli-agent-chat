import type { z } from "zod"
import type { agentSchema } from "./schemas.ts"
import type { TimelineItem } from "./timeline/reduce.ts"

export type SessionState =
  "starting" | "idle" | "busy" | "waiting" | "exited" | "failed"

export type Agent = {
  id: string
  name: string
  colour: string
  model: string
  permissionMode: string
  cwd: string | null
  autostart: boolean
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
  description: string | null
  maxTurns: number | null
  createdAt: string
}

export type NewAgent = z.output<typeof agentSchema>

export type SessionConfig = Pick<
  Agent,
  | "model"
  | "permissionMode"
  | "allowedTools"
  | "disallowedTools"
  | "systemPrompt"
  | "maxTurns"
> & { cwd: string }

export type SessionCard = {
  claudeSessionId: string | null
  state: SessionState
  model: string
  permissionMode: string
  directory: string
  allowedTools: string[]
  turns: number
  costUsd: number
  configChanged: boolean
}

export type LogLine = {
  seq: number
  sessionId: string
  direction: "in" | "out"
  at: string
  text: string
}

export type Conversation = {
  id: string
  kind: "channel" | "group" | "dm"
  name: string
  topic: string | null
  private: boolean
  replyMode: "mention" | "every"
  cwd: string | null
  members: string[]
  createdAt: string
}

export type NewConversation = Omit<Conversation, "id" | "createdAt" | "cwd"> & {
  cwd?: string | null
}

export type TimelineEntry = {
  id: string
  seq: number
  authorKey: string
  createdAt: string
  item: TimelineItem
}
