import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { useNow } from "@/hooks/use-now"
import type { ConversationAgent, TimelineEntry } from "@/lib/agent-api"
import { elapsed } from "@/lib/time"
import { activityOf, turnStartOf } from "@/lib/working"
import { shownName } from "../../../server/agent-names.ts"

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
              {shownName(agent)} {activityOf(agent, entries)}
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
