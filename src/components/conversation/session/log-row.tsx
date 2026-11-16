import { PlayIcon } from "lucide-react"

import { prettyLine, summaryOf } from "@/lib/log-lines"
import { clockSeconds, clockTime } from "@/lib/time"
import { cn } from "@/lib/utils"

export function LogRow({
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
