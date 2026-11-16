import type { ConversationAgent, TimelineEntry } from "@/lib/agent-api"
import { mainInput } from "@/lib/tool-input"

export function activityOf(
  agent: ConversationAgent,
  entries: TimelineEntry[]
): string {
  const last = entries.findLast(
    ({ authorKey, item }) =>
      authorKey === `agent:${agent.id}` &&
      !(item.kind === "tool_call" && item.parentToolUseId)
  )?.item
  if (last?.kind === "tool_call" && last.status === "running") {
    return `is running ${last.name} ${mainInput(last.name, last.input, agent.sessionCwd)}`
  }
  if (last?.kind === "message" && last.status === "streaming") {
    return "is writing"
  }
  return "is working"
}

export function turnStartOf(
  agent: ConversationAgent,
  entries: TimelineEntry[]
): string | undefined {
  const key = `agent:${agent.id}`
  const lastTurn = entries.findLastIndex(
    (entry) => entry.authorKey === key && entry.item.kind === "turn"
  )
  const turn = entries.slice(lastTurn + 1)
  const firstOwn = turn.findIndex((entry) => entry.authorKey === key)
  return turn
    .slice(0, firstOwn === -1 ? undefined : firstOwn)
    .findLast(
      (entry) => entry.authorKey !== key && entry.item.kind === "message"
    )?.createdAt
}
