import { ClockIcon } from "lucide-react"

import { LogRow } from "@/components/conversation/session/log-row"
import { Button } from "@/components/ui/button"
import { useSessionLog } from "@/hooks/use-session-log"
import { cn } from "@/lib/utils"

export function SessionLogTab({
  conversationId,
  agentId,
}: {
  conversationId: string
  agentId: string
}) {
  const { lines, more, live, loadEarlier } = useSessionLog(
    conversationId,
    agentId
  )
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="m-0 min-w-60 flex-1 text-[13px] text-muted-foreground">
          Each line that the app wrote to the process (
          <code className="font-mono text-agent-yellow">in</code>) or read from
          it (<code className="font-mono text-agent-blue">out</code>). Select a
          line to see its JSON.
        </p>
        <p
          role="status"
          aria-label="Stream"
          className="m-0 inline-flex items-center gap-1.5 text-xs text-foreground-faint"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              live ? "bg-status-online" : "bg-status-idle"
            )}
          />
          {live ? "Live" : "Connecting"}
        </p>
      </div>
      {more && (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          onClick={() => void loadEarlier()}
        >
          <ClockIcon />
          Load earlier lines
        </Button>
      )}
      <ol
        aria-label="Session log"
        className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border p-0 font-mono text-[13px] leading-5 [&>li:first-child]:border-t-0"
      >
        {lines.map((line, index) => (
          <LogRow
            key={line.seq}
            line={line}
            startsProcess={lines[index - 1]?.sessionId !== line.sessionId}
          />
        ))}
      </ol>
    </div>
  )
}
