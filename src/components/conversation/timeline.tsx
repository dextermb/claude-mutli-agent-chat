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
} from "@/lib/agent-api"

type Answer = (requestId: string, answer: RequestAnswer) => void

type TimelineProps = {
  entries: TimelineEntry[]
  agents: AgentWithState[]
  onAnswer: Answer
}

type Group = { authorKey: string; entries: TimelineEntry[] }

export function Timeline({ entries, agents, onAnswer }: TimelineProps) {
  const requests = requestsByToolUse(entries)
  const shown = entries.filter(
    (entry) =>
      entry.item.kind !== "permission" ||
      !hasToolCall(entries, entry.item.toolUseId)
  )
  return (
    <div className="flex flex-col gap-1 py-3">
      {groupByAuthor(shown).map((group) => (
        <AuthorGroup
          key={group.entries[0].id}
          group={group}
          agent={agents.find(
            (agent) => `agent:${agent.id}` === group.authorKey
          )}
          requests={requests}
          onAnswer={onAnswer}
        />
      ))}
    </div>
  )
}

function AuthorGroup({
  group,
  agent,
  requests,
  onAnswer,
}: {
  group: Group
  agent: AgentWithState | undefined
  requests: Map<string, PermissionItem>
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
        </div>
        {group.entries.map((entry) => (
          <EntryBody
            key={entry.id}
            entry={entry}
            agent={agent}
            requests={requests}
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
  onAnswer,
}: {
  entry: TimelineEntry
  agent: AgentWithState | undefined
  requests: Map<string, PermissionItem>
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
    if (last && last.authorKey === entry.authorKey) {
      last.entries.push(entry)
    } else {
      groups.push({ authorKey: entry.authorKey, entries: [entry] })
    }
  }
  return groups
}
