import { useEffect, useState } from "react"

import { mainInput } from "@/components/conversation/tool-call-line"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { ConversationAgent, TimelineEntry } from "@/lib/agent-api"

export function WorkingLines({
  agents,
  entries,
}: {
  agents: ConversationAgent[]
  entries: TimelineEntry[]
}) {
  const working = agents.filter((agent) => agent.state === "busy")
  const now = useNow(working.length > 0)
  if (working.length === 0) return null
  return (
    <Trace className="gap-1 px-5 py-1">
      {working.map((agent) => {
        const start = turnStartOf(agent, entries)
        const seconds = start ? Math.floor((now - Date.parse(start)) / 1000) : 0
        return (
          <TraceLine key={agent.id} role="status" status="running">
            <TraceIcon>
              <Spinner />
            </TraceIcon>
            <TraceTitle>
              {agent.name} {activityOf(agent, entries)}
            </TraceTitle>{" "}
            {seconds >= 3 && (
              <TraceDescription aria-hidden="true">
                · {elapsed(seconds)}
              </TraceDescription>
            )}
          </TraceLine>
        )
      })}
    </Trace>
  )
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}

function elapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function activityOf(
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

function turnStartOf(
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
