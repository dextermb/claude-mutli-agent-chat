import type { Json } from "../../server/protocol/decode.ts"
import type {
  Agent,
  Conversation,
  SessionCard,
  SessionState,
  TimelineEntry,
} from "../../server/api-types.ts"

export type {
  MessageItem,
  PermissionItem,
  QuestionItem,
  TimelineItem,
  ToolCallItem,
  ToolCallResult,
  TurnItem,
} from "../../server/timeline/reduce.ts"
export type {
  Agent,
  Conversation,
  Json,
  SessionCard,
  SessionState,
  TimelineEntry,
}

export type AgentWithState = Agent & { state: SessionState }

export type StreamMessage =
  | { type: "item"; entry: TimelineEntry }
  | { type: "agent_state"; agentId: string; state: SessionState }
  | { type: "conversation"; conversation: Conversation }
  | { type: "reset" }
