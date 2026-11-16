import { Fragment } from "react"

import { AuthorGroup } from "@/components/conversation/timeline/author-group"
import { CompactionDivider } from "@/components/conversation/timeline/compaction-divider"
import { DayHeading } from "@/components/conversation/timeline/day-heading"
import { SessionDivider } from "@/components/conversation/timeline/session-divider"
import type { ConversationAgent, TimelineEntry } from "@/lib/agent-api"
import { dayKey } from "@/lib/time"
import {
  groupByAuthor,
  hasToolCall,
  requestsByToolUse,
  subagentCallsByParent,
  turnsOfCompactions,
  type Answer,
} from "@/lib/timeline"

type TimelineProps = {
  entries: TimelineEntry[]
  agents: ConversationAgent[]
  onAnswer: Answer
}

export function Timeline({ entries, agents, onAnswer }: TimelineProps) {
  const requests = requestsByToolUse(entries)
  const subagentCalls = subagentCallsByParent(entries)
  const compactionTurns = turnsOfCompactions(entries)
  const shown = entries.filter(
    (entry) =>
      ![...compactionTurns.values()].includes(entry) &&
      !(entry.item.kind === "compaction" && entry.item.status === "failed") &&
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
            ) : group.entries[0].item.kind === "compaction" ? (
              <CompactionDivider
                item={group.entries[0].item}
                turn={compactionTurns.get(group.entries[0].id)}
                createdAt={createdAt}
                agentName={agent?.name ?? "The agent"}
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
