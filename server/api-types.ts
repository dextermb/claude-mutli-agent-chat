import type { TimelineItem } from "./timeline/reduce.ts"

export type SessionState =
  "starting" | "idle" | "busy" | "waiting" | "exited" | "failed"

export type Agent = {
  id: string
  name: string
  colour: string
  model: string
  permissionMode: string
  cwd: string
  autostart: boolean
  allowedTools: string[]
  disallowedTools: string[]
  systemPrompt: string | null
  createdAt: string
}

export type NewAgent = Omit<Agent, "id" | "createdAt">

export type Conversation = {
  id: string
  kind: "channel" | "group" | "dm"
  name: string
  topic: string | null
  private: boolean
  replyMode: "mention" | "every"
  members: string[]
  createdAt: string
}

export type NewConversation = Omit<Conversation, "id" | "createdAt">

export type TimelineEntry = {
  id: string
  seq: number
  authorKey: string
  item: TimelineItem
}
