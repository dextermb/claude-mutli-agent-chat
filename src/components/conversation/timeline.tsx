import { TriangleAlertIcon } from "lucide-react"
import { Fragment } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
import { QuestionCard } from "@/components/conversation/question-card"
import { ToolCallCard } from "@/components/conversation/tool-call-card"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type {
  AgentWithState,
  PermissionItem,
  TimelineEntry,
  ToolCallItem,
} from "@/lib/agent-api"
import { Separator } from "@/components/ui/separator"
import { clockTime, dayKey, dayName, longDay } from "@/lib/time"
import { cn } from "@/lib/utils"

type Answer = (requestId: string, answer: RequestAnswer) => void

type TimelineProps = {
  entries: TimelineEntry[]
  agents: AgentWithState[]
  onAnswer: Answer
}

type Group = { authorKey: string; entries: TimelineEntry[] }

export function Timeline({ entries, agents, onAnswer }: TimelineProps) {
  const requests = requestsByToolUse(entries)
  const subagentCalls = subagentCallsByParent(entries)
  const shown = entries.filter(
    (entry) =>
      !(entry.item.kind === "tool_call" && entry.item.parentToolUseId) &&
      (entry.item.kind !== "permission" ||
        !hasToolCall(entries, entry.item.toolUseId))
  )
  return (
    <div className="flex flex-col gap-1 py-3">
      {groupByAuthor(shown).map((group, index, groups) => {
        const createdAt = group.entries[0].createdAt
        const newDay =
          index === 0 ||
          dayKey(groups[index - 1].entries[0].createdAt) !== dayKey(createdAt)
        return (
          <Fragment key={group.entries[0].id}>
            {newDay && <DayHeading createdAt={createdAt} />}
            <AuthorGroup
              group={group}
              agent={agents.find(
                (agent) => `agent:${agent.id}` === group.authorKey
              )}
              requests={requests}
              subagentCalls={subagentCalls}
              onAnswer={onAnswer}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

function DayHeading({ createdAt }: { createdAt: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <Separator className="flex-1" />
      <h2 className="m-0 text-xs font-medium text-foreground-faint">
        {dayName(createdAt)}
      </h2>
      <Separator className="flex-1" />
    </div>
  )
}

function AuthorGroup({
  group,
  agent,
  requests,
  subagentCalls,
  onAnswer,
}: {
  group: Group
  agent: AgentWithState | undefined
  requests: Map<string, PermissionItem>
  subagentCalls: Map<string, ToolCallItem[]>
  onAnswer: Answer
}) {
  const name = agent ? agent.name : "You"
  return (
    <article className="flex gap-3 px-5 py-2">
      <Avatar className="flex-none">
        <AvatarFallback
          className={agent ? AVATAR_COLOURS[agent.colour] : "bg-human"}
        >
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground-strong">{name}</span>
          {agent && <Badge>Agent</Badge>}
          <time
            dateTime={group.entries[0].createdAt}
            className="text-xs text-foreground-faint"
          >
            {clockTime(group.entries[0].createdAt)}
          </time>
        </div>
        {group.entries.map((entry) => (
          <EntryBody
            key={entry.id}
            entry={entry}
            agent={agent}
            requests={requests}
            subagentCalls={subagentCalls}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </article>
  )
}

function EntryBody({
  entry,
  agent,
  requests,
  subagentCalls,
  onAnswer,
}: {
  entry: TimelineEntry
  agent: AgentWithState | undefined
  requests: Map<string, PermissionItem>
  subagentCalls: Map<string, ToolCallItem[]>
  onAnswer: Answer
}) {
  const { item } = entry
  if (item.kind === "tool_call") {
    return (
      <ToolCallCard
        call={item}
        cwd={agent?.cwd ?? ""}
        request={requests.get(item.toolUseId)}
        agentName={agent?.name ?? "the agent"}
        onAnswer={onAnswer}
        subagentCalls={subagentCalls.get(item.toolUseId)}
        requests={requests}
      />
    )
  }
  if (item.kind === "question") {
    return <QuestionCard card={item} onAnswer={onAnswer} />
  }
  if (item.kind === "turn") {
    const seconds = `${(item.durationMs / 1000).toFixed(1)} s`
    return (
      <p className="m-0 text-xs text-foreground-faint">
        {item.status === "stopped"
          ? `Stopped after ${seconds}`
          : `Done in ${seconds} · $${item.costUsd.toFixed(3)} · ${item.numTurns} turns`}
      </p>
    )
  }
  if (item.kind === "notice") {
    const limit = item.rateLimitType.replaceAll("_", "-")
    const resetsAt = new Date(item.resetsAt * 1000).toISOString()
    const resets =
      dayKey(resetsAt) === new Date().toDateString()
        ? `at ${clockTime(resetsAt)}`
        : `on ${longDay(resetsAt)} at ${clockTime(resetsAt)}`
    return (
      <p
        className={cn(
          "m-0 flex items-center gap-2 text-[13px]",
          item.status === "rejected"
            ? "text-status-error"
            : "text-status-working"
        )}
      >
        <TriangleAlertIcon aria-hidden="true" className="size-4 flex-none" />
        {`The ${limit} rate limit is ${
          item.status === "rejected" ? "reached" : "near"
        }. It resets ${resets}.`}
      </p>
    )
  }
  if (item.kind === "message") {
    return (
      <p
        aria-busy={item.status === "streaming"}
        className="m-0 leading-[22px] whitespace-pre-wrap"
      >
        {item.text}
      </p>
    )
  }
  return null
}

function subagentCallsByParent(
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

function requestsByToolUse(
  entries: TimelineEntry[]
): Map<string, PermissionItem> {
  const requests = new Map<string, PermissionItem>()
  for (const { item } of entries) {
    if (item.kind === "permission") requests.set(item.toolUseId, item)
  }
  return requests
}

function hasToolCall(entries: TimelineEntry[], toolUseId: string): boolean {
  return entries.some(
    ({ item }) => item.kind === "tool_call" && item.toolUseId === toolUseId
  )
}

function groupByAuthor(entries: TimelineEntry[]): Group[] {
  const groups: Group[] = []
  for (const entry of entries) {
    const last = groups.at(-1)
    if (
      last &&
      last.authorKey === entry.authorKey &&
      dayKey(last.entries[0].createdAt) === dayKey(entry.createdAt)
    ) {
      last.entries.push(entry)
    } else {
      groups.push({ authorKey: entry.authorKey, entries: [entry] })
    }
  }
  return groups
}
