import type { RequestAnswer } from "@/hooks/use-conversation"
import type {
  PermissionItem,
  TimelineEntry,
  ToolCallItem,
} from "@/lib/agent-api"
import { dayKey } from "@/lib/time"

export type Answer = (
  requestId: string,
  answer: RequestAnswer
) => Promise<boolean>

export type Group = { authorKey: string; entries: TimelineEntry[] }

export function entryAnchor(entryId: string): string {
  return `entry-${entryId}`
}

export function subagentCallsByParent(
  entries: TimelineEntry[]
): Map<string, ToolCallItem[]> {
  const calls = new Map<string, ToolCallItem[]>()
  for (const { item } of entries) {
    if (item.kind !== "tool_call" || !item.parentToolUseId) continue
    calls.set(item.parentToolUseId, [
      ...(calls.get(item.parentToolUseId) ?? []),
      item,
    ])
  }
  return calls
}

export function requestsByToolUse(
  entries: TimelineEntry[]
): Map<string, PermissionItem> {
  const requests = new Map<string, PermissionItem>()
  for (const { item } of entries) {
    if (item.kind === "permission") requests.set(item.toolUseId, item)
  }
  return requests
}

export function hasToolCall(entries: TimelineEntry[], toolUseId: string): boolean {
  return entries.some(
    ({ item }) => item.kind === "tool_call" && item.toolUseId === toolUseId
  )
}

export function runsOfCalls(entries: TimelineEntry[]): TimelineEntry[][] {
  const runs: TimelineEntry[][] = []
  for (const entry of entries) {
    const last = runs.at(-1)
    if (
      last &&
      last[0].item.kind === "tool_call" &&
      entry.item.kind === "tool_call"
    ) {
      last.push(entry)
    } else {
      runs.push([entry])
    }
  }
  return runs
}

export function groupByAuthor(entries: TimelineEntry[]): Group[] {
  const groups: Group[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (
      last &&
      last.authorKey === entry.authorKey &&
      dayKey(last.entries[0].createdAt) === dayKey(entry.createdAt) &&
      !isDivider(last.entries[0]) &&
      !isDivider(entry)
    ) {
      last.entries.push(entry)
    } else {
      groups.push({ authorKey: entry.authorKey, entries: [entry] })
    }
  }
  return groups
}

export function isDivider(entry: TimelineEntry): boolean {
  return entry.item.kind === "session_start" || entry.item.kind === "compaction"
}

export function turnsOfCompactions(
  entries: TimelineEntry[]
): Map<string, TimelineEntry> {
  const turns = new Map<string, TimelineEntry>()
  entries.forEach((entry, index) => {
    const before = entries[index - 1]
    if (
      entry.item.kind === "turn" &&
      before?.item.kind === "compaction" &&
      before.item.status === "done" &&
      before.authorKey === entry.authorKey
    ) {
      turns.set(before.id, entry)
    }
  })
  return turns
}
