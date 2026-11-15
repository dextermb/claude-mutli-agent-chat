import { ClockIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSessionLog } from "@/hooks/use-session-log"
import { prettyLine, summaryOf } from "@/lib/log-lines"
import { clockSeconds, clockTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export function SessionLogTab({
  conversationId,
  agentId,
}: {
  conversationId: string
  agentId: string
}) {
  const { lines, more, loadEarlier } = useSessionLog(conversationId, agentId)
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <p className="m-0 text-[13px] text-muted-foreground">
        Each line that the app wrote to the process (
        <code className="font-mono text-agent-yellow">in</code>) or read from it
        (<code className="font-mono text-agent-blue">out</code>). Select a line
        to see its JSON.
      </p>
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

function LogRow({
  line,
  startsProcess,
}: {
  line: { sessionId: string; direction: string; at: string; text: string }
  startsProcess: boolean
}) {
  return (
    <>
      {startsProcess && (
        <li className="border-t bg-rail px-3 py-1.5 font-sans text-xs text-foreground-faint">
          <p className="m-0 flex items-center gap-2.5">
            <PlayIcon aria-hidden="true" className="size-3.5" />
            {`Process started · ${clockTime(line.at)}`}
          </p>
        </li>
      )}
      <li className="border-t">
        <details>
          <summary className="flex cursor-pointer items-center gap-3 px-3 py-1.5">
            <span className="text-foreground-faint tabular-nums">
              {clockSeconds(line.at)}
            </span>{" "}
            <span
              className={cn(
                "w-7 flex-none",
                line.direction === "in"
                  ? "text-agent-yellow"
                  : "text-agent-blue"
              )}
            >
              {line.direction}
            </span>{" "}
            <span className="min-w-0 flex-1 truncate text-foreground-strong">
              {summaryOf(line.text)}
            </span>
          </summary>
          <pre className="m-0 overflow-x-auto bg-rail py-2.5 pr-3 pl-[52px] whitespace-pre text-muted-foreground">
            {prettyLine(line.text)}
          </pre>
        </details>
      </li>
    </>
  )
}
