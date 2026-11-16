import { FileIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { Fragment, useState, type ReactNode } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  AVATAR_COLOURS,
  HUMAN_AVATAR,
  initialsOf,
  MENTION_COLOURS,
} from "@/components/conversation/agent-look"
import { QuestionCard } from "@/components/conversation/question-card"
import { MessageFiles } from "@/components/conversation/shared-files"
import { ToolCallCard } from "@/components/conversation/tool-call-card"
import type { RequestAnswer } from "@/hooks/use-conversation"
import type {
  ConversationAgent,
  PermissionItem,
  TimelineEntry,
  ToolCallItem,
} from "@/lib/agent-api"
import { Separator } from "@/components/ui/separator"
import { clockTime, dayKey, dayName, longDay } from "@/lib/time"
import { cn } from "@/lib/utils"
import { mentionPattern } from "../../../server/conversation/mentions.ts"

type Answer = (requestId: string, answer: RequestAnswer) => void

type TimelineProps = {
  entries: TimelineEntry[]
  agents: ConversationAgent[]
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
        const agent = agents.find(
          (agent) => `agent:${agent.id}` === group.authorKey
        )
        return (
          <Fragment key={group.entries[0].id}>
            {newDay && <DayHeading createdAt={createdAt} />}
            {group.entries[0].item.kind === "session_start" ? (
              <SessionDivider
                createdAt={createdAt}
                agentName={agents.length > 1 ? agent?.name : undefined}
              />
            ) : (
              <AuthorGroup
                group={group}
                agent={agent}
                agents={agents}
                requests={requests}
                subagentCalls={subagentCalls}
                onAnswer={onAnswer}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function SessionDivider({
  createdAt,
  agentName,
}: {
  createdAt: string
  agentName: string | undefined
}) {
  const label = `New session${agentName ? ` for ${agentName}` : ""} · ${clockTime(createdAt)}`
  return (
    <div
      role="separator"
      aria-label={label}
      className="mx-5 my-1 flex items-center gap-3 text-xs text-link"
    >
      <span className="flex-1 border-t border-dashed border-link" />
      <span className="inline-flex items-center gap-1.5">
        <RotateCcwIcon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      <span className="flex-1 border-t border-dashed border-link" />
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
  agents,
  requests,
  subagentCalls,
  onAnswer,
}: {
  group: Group
  agent: ConversationAgent | undefined
  agents: ConversationAgent[]
  requests: Map<string, PermissionItem>
  subagentCalls: Map<string, ToolCallItem[]>
  onAnswer: Answer
}) {
  const name = agent ? agent.name : "You"
  return (
    <article className="flex gap-3 px-5 py-2">
      <Avatar className="flex-none">
        <AvatarFallback
          className={agent ? AVATAR_COLOURS[agent.colour] : HUMAN_AVATAR}
        >
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          className={cn(
            "flex gap-2",
            agent ? "items-center" : "items-baseline"
          )}
        >
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
            agents={agents}
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
  agents,
  requests,
  subagentCalls,
  onAnswer,
}: {
  entry: TimelineEntry
  agent: ConversationAgent | undefined
  agents: ConversationAgent[]
  requests: Map<string, PermissionItem>
  subagentCalls: Map<string, ToolCallItem[]>
  onAnswer: Answer
}) {
  const { item } = entry
  if (item.kind === "tool_call") {
    return (
      <ToolCallCard
        call={item}
        cwd={agent?.sessionCwd ?? ""}
        request={requests.get(item.toolUseId)}
        agentName={agent?.name ?? "the agent"}
        onAnswer={onAnswer}
        subagentCalls={subagentCalls.get(item.toolUseId)}
        requests={requests}
        anchorId={entryAnchor(entry.id)}
      />
    )
  }
  if (item.kind === "question") {
    return <QuestionCard card={item} onAnswer={onAnswer} />
  }
  if (item.kind === "turn") {
    const seconds = `${(item.durationMs / 1000).toFixed(1)} s`
    const spent = `$${item.costUsd.toFixed(3)} · ${item.numTurns} turns`
    return (
      <p className="m-0 text-xs text-foreground-faint">
        {item.status === "stopped" && `Stopped after ${seconds}`}
        {item.status === "limit" &&
          `Stopped at the turn limit after ${seconds} · ${spent}. Send a message to continue.`}
        {item.status === "done" && `Done in ${seconds} · ${spent}`}
      </p>
    )
  }
  if (item.kind === "notice" && item.reason === "failed") {
    return (
      <FailedNotice
        agentName={agent?.name ?? "The agent"}
        exitCode={item.exitCode}
        stderr={item.stderr}
      />
    )
  }
  if (item.kind === "notice" && item.reason === "rate_limit") {
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
      <>
        {item.text && (
          <p
            aria-busy={item.status === "streaming"}
            className={cn(
              "m-0 leading-[22px] whitespace-pre-wrap",
              item.status === "streaming" &&
                "after:ml-0.5 after:animate-pulse after:text-muted-foreground after:content-['▍'] motion-reduce:after:animate-none"
            )}
          >
            {withInlineCode(item.text, agents)}
          </p>
        )}
        {item.files && item.files.length > 0 && (
          <MessageFiles files={item.files} afterSeq={entry.seq} />
        )}
      </>
    )
  }
  return null
}

function withInlineCode(text: string, agents: ConversationAgent[]) {
  return text.split(/`([^`\n]+)`/).map((part, index) =>
    index % 2 === 1 ? (
      <code
        key={index}
        className="rounded-sm bg-muted px-[5px] py-px font-mono text-[13px] text-agent-yellow"
      >
        {part}
      </code>
    ) : (
      <Fragment key={index}>{withMentions(part, agents)}</Fragment>
    )
  )
}

type Mention = { at: number; text: string; agent?: ConversationAgent }

const FILE_MENTION = /(?<![\w@-])@([\w./-]*[\w-])/g

function withMentions(text: string, agents: ConversationAgent[]) {
  const agentMentions: Mention[] = agents.flatMap((agent) =>
    [...text.matchAll(mentionPattern(agent.name, "g"))].map((match) => ({
      at: match.index,
      text: match[0],
      agent,
    }))
  )
  const fileMentions: Mention[] = [...text.matchAll(FILE_MENTION)]
    .filter((match) => /\/|\.\w+$/.test(match[1]))
    .map((match) => ({ at: match.index, text: match[0] }))
  const parts: ReactNode[] = []
  let end = 0
  for (const mention of [...agentMentions, ...fileMentions].sort(
    (a, b) => a.at - b.at
  )) {
    parts.push(text.slice(end, mention.at))
    parts.push(
      mention.agent ? (
        <span
          key={mention.at}
          className={cn(
            "rounded-sm px-1 font-medium",
            MENTION_COLOURS[mention.agent.colour]
          )}
        >
          {mention.text}
        </span>
      ) : (
        <span
          key={mention.at}
          className="relative rounded-sm bg-link/10 px-1 font-mono text-[13px] text-link"
        >
          <FileIcon
            aria-hidden="true"
            className="mr-1 inline size-3.5 align-[-2px]"
          />
          <span className="sr-only">@</span>
          {mention.text.slice(1)}
        </span>
      )
    )
    end = mention.at + mention.text.length
  }
  parts.push(text.slice(end))
  return parts
}

function FailedNotice({
  agentName,
  exitCode,
  stderr,
}: {
  agentName: string
  exitCode: number | null
  stderr: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-1.5 text-[13px] text-status-error">
      <p className="m-0 flex items-center gap-2">
        <TriangleAlertIcon aria-hidden="true" className="size-4 flex-none" />
        {exitCode === null
          ? `${agentName} stopped with an error.`
          : `${agentName} stopped with an error (exit code ${exitCode}).`}
        {stderr !== "" && (
          <button
            type="button"
            aria-expanded={open}
            className="text-muted-foreground underline hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide details" : "Show details"}
          </button>
        )}
      </p>
      {open && (
        <pre className="m-0 max-w-[640px] overflow-x-auto rounded-[14px] border bg-rail px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {stderr}
        </pre>
      )}
    </div>
  )
}

export function entryAnchor(entryId: string): string {
  return `entry-${entryId}`
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
      dayKey(last.entries[0].createdAt) === dayKey(entry.createdAt) &&
      last.entries[0].item.kind !== "session_start" &&
      entry.item.kind !== "session_start"
    ) {
      last.entries.push(entry)
    } else {
      groups.push({ authorKey: entry.authorKey, entries: [entry] })
    }
  }
  return groups
}
