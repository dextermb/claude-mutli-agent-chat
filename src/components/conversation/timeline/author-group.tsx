import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trace } from "@/components/ui/trace"
import {
  AVATAR_COLOURS,
  initialsOf,
} from "@/components/conversation/agent-look"
import { EntryBody } from "@/components/conversation/timeline/entry-body"
import type {
  ConversationAgent,
  PermissionItem,
  ToolCallItem,
} from "@/lib/agent-api"
import { clockTime } from "@/lib/time"
import { runsOfCalls, type Answer, type Group } from "@/lib/timeline"
import { shownName } from "../../../../server/agent-names.ts"

export function AuthorGroup({
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
  const createdAt = group.entries[0].createdAt
  const entries = runsOfCalls(group.entries).map((run) => {
    const bodies = run.map((entry) => (
      <EntryBody
        key={entry.id}
        entry={entry}
        agent={agent}
        agents={agents}
        requests={requests}
        subagentCalls={subagentCalls}
        onAnswer={onAnswer}
      />
    ))
    return run[0].item.kind === "tool_call" ? (
      <Trace key={run[0].id}>{bodies}</Trace>
    ) : (
      bodies
    )
  })
  if (!agent) {
    return (
      <article
        aria-label={`You, ${clockTime(createdAt)}`}
        className="flex flex-col items-end gap-1 px-5 py-2"
      >
        {entries}
        <time dateTime={createdAt} className="text-xs text-foreground-faint">
          {clockTime(createdAt)}
        </time>
      </article>
    )
  }
  return (
    <article
      aria-label={`${shownName(agent)}, ${clockTime(createdAt)}`}
      className="flex flex-col gap-2 px-5 py-2"
    >
      <div className="flex items-center gap-2">
        <Avatar size="sm" className="flex-none">
          <AvatarFallback className={AVATAR_COLOURS[agent.colour]}>
            {initialsOf(shownName(agent))}
          </AvatarFallback>
        </Avatar>
        <span className="font-semibold text-foreground-strong">
          {shownName(agent)}
        </span>
        {agent.deletedAt ? (
          <Badge variant="outline">Deleted agent</Badge>
        ) : (
          <Badge>Agent</Badge>
        )}
        <time dateTime={createdAt} className="text-xs text-foreground-faint">
          {clockTime(createdAt)}
        </time>
      </div>
      <div className="flex min-w-0 flex-col gap-2">{entries}</div>
    </article>
  )
}
