import type { Json } from "../../server/protocol/decode.ts"
import type {
  Agent,
  Conversation,
  LogLine,
  SessionCard,
  SessionState,
  SharedFileView,
  TimelineEntry,
} from "../../server/api-types.ts"

export type { SharedFileView } from "../../server/api-types.ts"

export type {
  MessageItem,
  SharedFile,
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
  LogLine,
  SessionCard,
  SessionState,
  TimelineEntry,
}

export type AgentWithState = Agent & { state: SessionState }

export type StreamMessage =
  | { type: "item"; entry: TimelineEntry }
  | { type: "agent_state"; agentId: string; state: SessionState }
  | { type: "conversation"; conversation: Conversation }
  | { type: "unread"; conversationId: string; count: number }
  | { type: "reset" }
  | { type: "line"; agentId: string; line: LogLine }
  | { type: "files"; files: SharedFileView[] }
